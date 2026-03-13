const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const ebay = require('../ebay');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !user.access_token) return res.status(401).json({ error: 'eBay not connected' });
  req.user = user;
  next();
}

// Get all sales with filters
router.get('/', requireAuth, (req, res) => {
  const { from, to, search, limit = 100, offset = 0 } = req.query;

  let query = 'SELECT * FROM sales WHERE user_id = ?';
  const params = [req.user.id];

  if (from) { query += ' AND sale_date >= ?'; params.push(parseInt(from)); }
  if (to) { query += ' AND sale_date <= ?'; params.push(parseInt(to)); }
  if (search) {
    query += ' AND (item_title LIKE ? OR sku LIKE ? OR custom_label LIKE ? OR order_id LIKE ? OR buyer_username LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  query += ' ORDER BY sale_date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const sales = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM sales WHERE user_id = ?').get(req.user.id);

  res.json({ sales, total: total.count });
});

// Get sales summary/stats
router.get('/summary', requireAuth, (req, res) => {
  const { days = 30 } = req.query;
  const since = Date.now() - (days * 24 * 60 * 60 * 1000);

  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      SUM(quantity) as total_items_sold,
      SUM(total_price) as gross_revenue,
      SUM(net_profit) as net_profit,
      SUM(ebay_fees) as total_fees,
      AVG(total_price) as avg_order_value,
      COUNT(DISTINCT buyer_username) as unique_buyers
    FROM sales
    WHERE user_id = ? AND sale_date >= ?
  `).get(req.user.id, since);

  // Sales by day for chart
  const dailySales = db.prepare(`
    SELECT
      date(sale_date/1000, 'unixepoch') as day,
      COUNT(*) as orders,
      SUM(total_price) as revenue,
      SUM(quantity) as items
    FROM sales
    WHERE user_id = ? AND sale_date >= ?
    GROUP BY day
    ORDER BY day ASC
  `).all(req.user.id, since);

  // Top selling items
  const topItems = db.prepare(`
    SELECT
      item_title,
      sku,
      custom_label,
      SUM(quantity) as total_sold,
      SUM(total_price) as total_revenue,
      COUNT(*) as order_count
    FROM sales
    WHERE user_id = ? AND sale_date >= ?
    GROUP BY COALESCE(sku, item_title)
    ORDER BY total_sold DESC
    LIMIT 10
  `).all(req.user.id, since);

  res.json({ summary, dailySales, topItems });
});

// Sync orders from eBay
router.post('/sync', requireAuth, async (req, res) => {
  const syncId = uuidv4();

  try {
    const token = await ebay.getValidToken(req.user, db);
    let allOrders = [];
    let offset = 0;
    const limit = 200;
    let hasMore = true;

    // Fetch last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    while (hasMore) {
      const response = await ebay.ebayGet('/sell/fulfillment/v1/order', token, {
        limit,
        offset,
        filter: `lastmodifieddate:[${ninetyDaysAgo}]`
      });

      const orders = response.orders || [];
      allOrders = allOrders.concat(orders);

      if (orders.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    let synced = 0;
    const insertSale = db.prepare(`
      INSERT OR REPLACE INTO sales
        (id, user_id, order_id, item_id, item_title, sku, custom_label, quantity, sale_price, total_price, currency, buyer_username, sale_date, payment_status, shipping_status, tracking_number, buyer_country, ebay_fees, postage_cost, net_profit, order_line_item_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const order of allOrders) {
      const lineItems = order.lineItems || [];
      for (const item of lineItems) {
        const saleId = `${order.orderId}-${item.lineItemId}`;
        const saleDate = new Date(order.creationDate || order.lastModifiedDate).getTime();
        const unitPrice = parseFloat(item.lineItemCost?.value || 0);
        const qty = parseInt(item.quantity || 1);
        const totalPrice = parseFloat(order.pricingSummary?.total?.value || unitPrice * qty);
        const deliveryCost = parseFloat(order.pricingSummary?.deliveryCost?.value || 0);
        const ebayFees = parseFloat(order.totalFeeBasisAmount?.value || 0) * 0.1;
        const netProfit = totalPrice - ebayFees - deliveryCost;

        // Extract tracking
        let tracking = '';
        const fulfillments = order.fulfillmentStartInstructions || [];
        if (fulfillments.length > 0 && fulfillments[0].shippingStep) {
          tracking = fulfillments[0].shippingStep.shipTo?.trackingNumber || '';
        }

        // SKU/custom label from line item
        const sku = item.sku || item.legacyVariationId || '';
        const customLabel = item.properties?.customLabel || sku;

        insertSale.run(
          saleId,
          req.user.id,
          order.orderId,
          item.legacyItemId || item.itemId || '',
          item.title || '',
          sku,
          customLabel,
          qty,
          unitPrice,
          totalPrice,
          item.lineItemCost?.currency || 'GBP',
          order.buyer?.username || '',
          saleDate,
          order.orderPaymentStatus || 'PAID',
          order.orderFulfillmentStatus || 'NOT_STARTED',
          tracking,
          order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.countryCode || '',
          ebayFees,
          deliveryCost,
          netProfit,
          item.lineItemId
        );
        synced++;
      }
    }

    db.prepare(`
      INSERT INTO sync_log (id, user_id, sync_type, status, items_synced)
      VALUES (?, ?, 'sales', 'success', ?)
    `).run(syncId, req.user.id, synced);

    res.json({ success: true, synced, total: allOrders.length });
  } catch (err) {
    console.error('Sales sync error:', err.response?.data || err.message);
    db.prepare(`
      INSERT INTO sync_log (id, user_id, sync_type, status, error_message)
      VALUES (?, ?, 'sales', 'error', ?)
    `).run(syncId, req.user.id, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// CSV export
router.get('/export/csv', requireAuth, (req, res) => {
  const { from, to } = req.query;
  let query = 'SELECT * FROM sales WHERE user_id = ?';
  const params = [req.user.id];
  if (from) { query += ' AND sale_date >= ?'; params.push(parseInt(from)); }
  if (to) { query += ' AND sale_date <= ?'; params.push(parseInt(to)); }
  query += ' ORDER BY sale_date DESC';

  const sales = db.prepare(query).all(...params);

  const headers = ['order_id','item_id','item_title','sku','custom_label','quantity','sale_price','total_price','currency','ebay_fees','postage_cost','net_profit','buyer_username','buyer_country','sale_date','payment_status','shipping_status','tracking_number'];
  const rows = sales.map(s =>
    headers.map(h => {
      const v = h === 'sale_date' ? new Date(s[h]).toISOString() : (s[h] ?? '');
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="ebay-sales-${Date.now()}.csv"`);
  res.send([headers.join(','), ...rows].join('\n'));
});

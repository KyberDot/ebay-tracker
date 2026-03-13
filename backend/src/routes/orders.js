const express = require('express');
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

// Get orders with full detail
router.get('/', requireAuth, (req, res) => {
  const { search, from, to, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT order_id,
      MAX(buyer_username) as buyer_username,
      MAX(sale_date) as sale_date,
      MAX(payment_status) as payment_status,
      MAX(shipping_status) as shipping_status,
      MAX(tracking_number) as tracking_number,
      MAX(buyer_country) as buyer_country,
      MAX(currency) as currency,
      SUM(total_price) as total_price,
      SUM(quantity) as total_items,
      COUNT(*) as line_items,
      SUM(ebay_fees) as ebay_fees,
      SUM(postage_cost) as postage_cost,
      SUM(net_profit) as net_profit
    FROM sales WHERE user_id = ?
  `;
  const params = [req.user.id];

  if (from) { query += ' AND sale_date >= ?'; params.push(parseInt(from)); }
  if (to) { query += ' AND sale_date <= ?'; params.push(parseInt(to)); }
  if (search) {
    query += ' AND (order_id LIKE ? OR buyer_username LIKE ? OR item_title LIKE ? OR sku LIKE ? OR custom_label LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  query += ' GROUP BY order_id ORDER BY sale_date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const orders = db.prepare(query).all(...params);

  // Get line items for each order
  const enriched = orders.map(order => {
    const lineItems = db.prepare(`
      SELECT item_id, item_title, sku, custom_label, quantity, sale_price, total_price
      FROM sales WHERE user_id = ? AND order_id = ?
    `).all(req.user.id, order.order_id);
    return { ...order, lineItems };
  });

  const totalCount = db.prepare(`
    SELECT COUNT(DISTINCT order_id) as count FROM sales WHERE user_id = ?
  `).get(req.user.id);

  res.json({ orders: enriched, total: totalCount.count });
});

// Live fetch single order from eBay
router.get('/:orderId/live', requireAuth, async (req, res) => {
  try {
    const token = await ebay.getValidToken(req.user, db);
    const order = await ebay.getOrderById(token, req.params.orderId);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

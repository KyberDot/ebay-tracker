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

// Get all tracked items
router.get('/', requireAuth, (req, res) => {
  const { search, status, limit = 100, offset = 0 } = req.query;

  let query = 'SELECT * FROM tracked_items WHERE user_id = ?';
  const params = [req.user.id];

  if (search) {
    query += ' AND (title LIKE ? OR sku LIKE ? OR custom_label LIKE ? OR tags LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (status) { query += ' AND listing_status = ?'; params.push(status); }

  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const items = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM tracked_items WHERE user_id = ?').get(req.user.id);

  // Enrich with recent sales count
  const enriched = items.map(item => {
    const recentSales = db.prepare(`
      SELECT SUM(quantity) as sold_30d, SUM(total_price) as revenue_30d
      FROM sales
      WHERE user_id = ? AND (sku = ? OR item_id = ?)
      AND sale_date >= ?
    `).get(req.user.id, item.sku || '', item.item_id, Date.now() - 30 * 24 * 60 * 60 * 1000);

    return { ...item, sold_30d: recentSales?.sold_30d || 0, revenue_30d: recentSales?.revenue_30d || 0 };
  });

  res.json({ items: enriched, total: total.count });
});

// Get single item with full sales history
router.get('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM tracked_items WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const sales = db.prepare(`
    SELECT * FROM sales
    WHERE user_id = ? AND (sku = ? OR item_id = ?)
    ORDER BY sale_date DESC LIMIT 50
  `).all(req.user.id, item.sku || '', item.item_id);

  res.json({ item, sales });
});

// Add/update tracked item manually
router.post('/', requireAuth, (req, res) => {
  const { item_id, title, sku, custom_label, category, condition, quantity_available, price, currency, listing_url, image_url, notes, tags, cost_price } = req.body;

  if (!item_id) return res.status(400).json({ error: 'item_id is required' });

  const existing = db.prepare('SELECT id FROM tracked_items WHERE user_id = ? AND item_id = ?').get(req.user.id, item_id);

  if (existing) {
    db.prepare(`
      UPDATE tracked_items SET
        title = COALESCE(?, title),
        sku = COALESCE(?, sku),
        custom_label = COALESCE(?, custom_label),
        category = COALESCE(?, category),
        condition = COALESCE(?, condition),
        quantity_available = COALESCE(?, quantity_available),
        price = COALESCE(?, price),
        listing_url = COALESCE(?, listing_url),
        image_url = COALESCE(?, image_url),
        notes = COALESCE(?, notes),
        tags = COALESCE(?, tags),
        cost_price = COALESCE(?, cost_price),
        updated_at = strftime('%s', 'now')
      WHERE id = ? AND user_id = ?
    `).run(title, sku, custom_label, category, condition, quantity_available, price, listing_url, image_url, notes, tags, cost_price, existing.id, req.user.id);

    return res.json({ id: existing.id, updated: true });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tracked_items (id, user_id, item_id, title, sku, custom_label, category, condition, quantity_available, price, currency, listing_url, image_url, notes, tags, cost_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, item_id, title, sku, custom_label, category, condition, quantity_available || 0, price, currency || 'GBP', listing_url, image_url, notes, tags, cost_price);

  res.json({ id, created: true });
});

// Update item notes/cost/tags
router.patch('/:id', requireAuth, (req, res) => {
  const { notes, tags, cost_price, quantity_available, custom_label } = req.body;

  db.prepare(`
    UPDATE tracked_items SET
      notes = COALESCE(?, notes),
      tags = COALESCE(?, tags),
      cost_price = COALESCE(?, cost_price),
      quantity_available = COALESCE(?, quantity_available),
      custom_label = COALESCE(?, custom_label),
      updated_at = strftime('%s', 'now')
    WHERE id = ? AND user_id = ?
  `).run(notes, tags, cost_price, quantity_available, custom_label, req.params.id, req.user.id);

  res.json({ success: true });
});

// Delete tracked item
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tracked_items WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Sync inventory from eBay
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const token = await ebay.getValidToken(req.user, db);

    let allItems = [];
    let offset = 0;
    const limit = 200;
    let hasMore = true;

    while (hasMore) {
      const response = await ebay.ebayGet('/sell/inventory/v1/inventory_item', token, { limit, offset });
      const items = response.inventoryItems || [];
      allItems = allItems.concat(items);

      if (items.length < limit) hasMore = false;
      else offset += limit;
    }

    let synced = 0;
    for (const item of allItems) {
      const { sku } = item;
      const product = item.product || {};
      const availability = item.availability?.shipToLocationAvailability || {};

      const existing = db.prepare('SELECT id FROM tracked_items WHERE user_id = ? AND (sku = ? OR item_id = ?)').get(req.user.id, sku, sku);
      const title = product.title || '';
      const price = item.availability?.pickupAtLocationAvailability?.[0]?.price?.value || 0;
      const qty = availability.quantity || 0;
      const imageUrl = product.imageUrls?.[0] || '';
      const description = product.description || '';
      const condition = item.condition || '';
      const category = product.aspects?.Category?.[0] || '';

      if (existing) {
        db.prepare(`
          UPDATE tracked_items SET title = ?, quantity_available = ?, image_url = ?, condition = ?, category = ?, updated_at = strftime('%s', 'now')
          WHERE id = ?
        `).run(title, qty, imageUrl, condition, category, existing.id);
      } else {
        db.prepare(`
          INSERT OR IGNORE INTO tracked_items (id, user_id, item_id, sku, title, quantity_available, image_url, condition, category, currency)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'GBP')
        `).run(uuidv4(), req.user.id, sku, sku, title, qty, imageUrl, condition, category);
      }
      synced++;
    }

    // Also sync from orders - extract unique items
    const ordersItems = db.prepare(`
      SELECT DISTINCT item_id, item_title, sku, custom_label
      FROM sales WHERE user_id = ?
    `).all(req.user.id);

    for (const oi of ordersItems) {
      if (!oi.item_id) continue;
      const exists = db.prepare('SELECT id FROM tracked_items WHERE user_id = ? AND item_id = ?').get(req.user.id, oi.item_id);
      if (!exists) {
        db.prepare(`
          INSERT OR IGNORE INTO tracked_items (id, user_id, item_id, sku, custom_label, title, currency)
          VALUES (?, ?, ?, ?, ?, ?, 'GBP')
        `).run(uuidv4(), req.user.id, oi.item_id, oi.sku || '', oi.custom_label || '', oi.item_title || '');
        synced++;
      }
    }

    res.json({ success: true, synced });
  } catch (err) {
    console.error('Inventory sync error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

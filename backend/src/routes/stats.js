const express = require('express');
const db = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  // Allow demo users (they have a demo-token but no real eBay connection)
  const isDemo = user.id === 'demo-user-00000000-0000-0000-0000-000000000001';
  if (!isDemo && !user.access_token) return res.status(401).json({ error: 'eBay not connected' });
  req.user = user;
  req.isDemo = isDemo;
  next();
}

// Revenue by month
router.get('/monthly', requireAuth, (req, res) => {
  const monthly = db.prepare(`
    SELECT
      strftime('%Y-%m', sale_date/1000, 'unixepoch') as month,
      COUNT(DISTINCT order_id) as orders,
      SUM(quantity) as items_sold,
      SUM(total_price) as gross_revenue,
      SUM(net_profit) as net_profit,
      SUM(ebay_fees) as fees
    FROM sales
    WHERE user_id = ?
    GROUP BY month
    ORDER BY month DESC
    LIMIT 24
  `).all(req.user.id);
  res.json({ monthly });
});

// Revenue by buyer country
router.get('/by-country', requireAuth, (req, res) => {
  const data = db.prepare(`
    SELECT
      COALESCE(buyer_country, 'Unknown') as country,
      COUNT(*) as orders,
      SUM(total_price) as revenue
    FROM sales
    WHERE user_id = ?
    GROUP BY buyer_country
    ORDER BY revenue DESC
    LIMIT 20
  `).all(req.user.id);
  res.json({ data });
});

// Sync history
router.get('/sync-log', requireAuth, (req, res) => {
  const logs = db.prepare(`
    SELECT * FROM sync_log WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(req.user.id);
  res.json({ logs });
});

module.exports = router;

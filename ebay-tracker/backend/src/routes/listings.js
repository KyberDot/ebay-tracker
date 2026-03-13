/**
 * Listings route - fetches active eBay listings via the Browse/Sell API
 * used as a fallback when Inventory API returns nothing (non-managed inventory sellers)
 */
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

// Fetch seller's active listings via Account/Listing API
router.get('/active', requireAuth, async (req, res) => {
  try {
    const token = await ebay.getValidToken(req.user, db);
    const data = await ebay.ebayGet('/sell/account/v1/fulfillment_policy', token);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

module.exports = router;

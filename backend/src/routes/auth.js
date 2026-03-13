const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const ebay = require('../ebay');

const router = express.Router();

// Check auth status
router.get('/status', (req, res) => {
  if (req.session.userId) {
    const user = db.prepare('SELECT id, username, email, ebay_user_id, updated_at FROM users WHERE id = ?').get(req.session.userId);
    if (user) {
      return res.json({ authenticated: true, user });
    }
  }
  res.json({ authenticated: false });
});

// Start eBay OAuth flow
router.get('/ebay/connect', (req, res) => {
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'eBay API credentials not configured. Please set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET environment variables.'
    });
  }
  const state = uuidv4();
  req.session.oauthState = state;
  const authUrl = ebay.getAuthUrl(state);
  res.json({ authUrl });
});

// eBay OAuth callback
router.get('/ebay/callback', async (req, res) => {
  const { code, state, error } = req.query;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error) {
    return res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}?auth_error=no_code`);
  }

  try {
    const tokenData = await ebay.exchangeCodeForToken(code);
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiry = Date.now() + (tokenData.expires_in * 1000);

    // Get user profile from eBay
    let ebayUser = {};
    try {
      ebayUser = await ebay.getUserProfile(accessToken);
    } catch (e) {
      console.error('Could not fetch eBay user profile:', e.message);
    }

    const ebayUserId = ebayUser.userId || ebayUser.username || 'unknown';
    const username = ebayUser.username || ebayUserId;
    const email = ebayUser.email || '';

    // Upsert user
    let user = db.prepare('SELECT * FROM users WHERE ebay_user_id = ?').get(ebayUserId);
    if (!user) {
      const userId = uuidv4();
      db.prepare(`
        INSERT INTO users (id, ebay_user_id, username, email, access_token, refresh_token, token_expiry)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, ebayUserId, username, email, accessToken, refreshToken, expiry);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    } else {
      db.prepare(`
        UPDATE users SET access_token = ?, refresh_token = ?, token_expiry = ?, username = ?, email = ?, updated_at = strftime('%s', 'now')
        WHERE id = ?
      `).run(accessToken, refreshToken, expiry, username, email, user.id);
    }

    req.session.userId = user.id;
    req.session.save(() => {
      res.redirect(`${frontendUrl}?auth_success=true`);
    });
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(err.message)}`);
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Disconnect eBay (remove tokens)
router.post('/disconnect', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  db.prepare('UPDATE users SET access_token = NULL, refresh_token = NULL WHERE id = ?').run(req.session.userId);
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

module.exports = router;

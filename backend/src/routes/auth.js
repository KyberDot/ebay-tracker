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

// Demo login - seeds fake data and logs in without eBay
router.post('/demo', (req, res) => {
  const DEMO_USER_ID = 'demo-user-00000000-0000-0000-0000-000000000001'

  // Create demo user if not exists
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(DEMO_USER_ID)
  if (!user) {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, ebay_user_id, username, email, access_token, refresh_token, token_expiry)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(DEMO_USER_ID, 'demo_seller_uk', 'demo_seller_uk', 'demo@example.com', 'demo-token', 'demo-refresh', Date.now() + 9999999999)

    // Seed demo sales
    const items = [
      { id: 'ITEM001', title: 'Vintage Sony Walkman TPS-L2', sku: 'ELEC-VNT-001', price: 89.99 },
      { id: 'ITEM002', title: 'Nike Air Max 90 Size 10', sku: 'SHOE-NKE-090', price: 65.00 },
      { id: 'ITEM003', title: 'Lego Technic 42099 4x4', sku: 'TOY-LGO-099', price: 120.00 },
      { id: 'ITEM004', title: 'Apple iPhone 12 64GB Black', sku: 'PHN-APL-I12', price: 299.99 },
      { id: 'ITEM005', title: 'Dyson V8 Absolute Hoover', sku: 'HOM-DYS-V8A', price: 185.00 },
      { id: 'ITEM006', title: 'Pokemon Card Charizard Holo', sku: 'TCG-PKM-CHZ', price: 45.00 },
      { id: 'ITEM007', title: 'Adidas Yeezy Boost 350 V2', sku: 'SHOE-ADI-350', price: 210.00 },
      { id: 'ITEM008', title: 'Nintendo Switch OLED White', sku: 'GAM-NTD-SWO', price: 249.99 },
    ]
    const buyers = ['johndoe_92', 'sarah_buys', 'techie_tom', 'bargainhunter_uk', 'retrofinds', 'sneakerhead99', 'ukreseller', 'collectables4u']
    const countries = ['GB', 'GB', 'GB', 'DE', 'FR', 'US', 'GB', 'IE']
    const statuses = ['PAID', 'PAID', 'PAID', 'PAID', 'PENDING']

    const insertSale = db.prepare(`
      INSERT OR IGNORE INTO sales
        (id, user_id, order_id, item_id, item_title, sku, custom_label, quantity, sale_price, total_price, currency, buyer_username, sale_date, payment_status, shipping_status, tracking_number, buyer_country, ebay_fees, postage_cost, net_profit, order_line_item_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GBP', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // Generate 60 days of demo sales
    for (let d = 0; d < 60; d++) {
      const numSales = Math.floor(Math.random() * 4) + 1
      for (let s = 0; s < numSales; s++) {
        const item = items[Math.floor(Math.random() * items.length)]
        const buyer = buyers[Math.floor(Math.random() * buyers.length)]
        const country = countries[Math.floor(Math.random() * countries.length)]
        const status = statuses[Math.floor(Math.random() * statuses.length)]
        const qty = Math.random() > 0.85 ? 2 : 1
        const postage = country === 'GB' ? 3.99 : 8.99
        const fees = item.price * qty * 0.12
        const net = (item.price * qty) - fees - postage
        const saleDate = Date.now() - (d * 24 * 60 * 60 * 1000) - Math.floor(Math.random() * 12 * 60 * 60 * 1000)
        const orderId = `28-${Math.floor(Math.random() * 90000 + 10000)}-${Math.floor(Math.random() * 90000 + 10000)}`
        const saleId = `${orderId}-${item.id}-${d}-${s}`

        insertSale.run(
          saleId, DEMO_USER_ID, orderId, item.id, item.title, item.sku, item.sku,
          qty, item.price, item.price * qty, buyer, saleDate, status,
          status === 'PAID' ? 'FULFILLED' : 'NOT_STARTED',
          status === 'PAID' ? `TRK${Math.floor(Math.random() * 999999999)}GB` : '',
          country, fees, postage, net, `LI-${saleId}`
        )
      }
    }

    // Seed demo inventory
    const insertItem = db.prepare(`
      INSERT OR IGNORE INTO tracked_items
        (id, user_id, item_id, sku, custom_label, title, quantity_available, price, cost_price, currency, listing_status, condition, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'GBP', 'Active', 'Used', ?)
    `)
    items.forEach((item, i) => {
      insertItem.run(
        `demo-item-${i}`, DEMO_USER_ID, item.id, item.sku, item.sku, item.title,
        Math.floor(Math.random() * 8) + 1, item.price,
        parseFloat((item.price * 0.55).toFixed(2)),
        ['electronics,vintage', 'fashion,shoes', 'toys,lego', 'phones,apple', 'home,dyson', 'collectables,pokemon', 'fashion,shoes', 'gaming,nintendo'][i]
      )
    })

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(DEMO_USER_ID)
  }

  req.session.userId = DEMO_USER_ID
  req.session.save(() => {
    res.json({ success: true, user: { id: user.id, username: user.username } })
  })
})

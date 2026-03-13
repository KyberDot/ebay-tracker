const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'ebay_tracker.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    ebay_user_id TEXT UNIQUE,
    username TEXT,
    email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS tracked_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    title TEXT,
    sku TEXT,
    custom_label TEXT,
    category TEXT,
    condition TEXT,
    quantity_available INTEGER DEFAULT 0,
    quantity_sold INTEGER DEFAULT 0,
    price REAL,
    currency TEXT DEFAULT 'GBP',
    listing_url TEXT,
    image_url TEXT,
    listing_status TEXT DEFAULT 'Active',
    notes TEXT,
    tags TEXT,
    cost_price REAL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    item_id TEXT,
    item_title TEXT,
    sku TEXT,
    custom_label TEXT,
    quantity INTEGER DEFAULT 1,
    sale_price REAL,
    total_price REAL,
    currency TEXT DEFAULT 'GBP',
    buyer_username TEXT,
    sale_date INTEGER,
    payment_status TEXT,
    shipping_status TEXT,
    tracking_number TEXT,
    buyer_country TEXT,
    ebay_fees REAL DEFAULT 0,
    postage_cost REAL DEFAULT 0,
    net_profit REAL,
    order_line_item_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sync_type TEXT,
    status TEXT,
    items_synced INTEGER DEFAULT 0,
    error_message TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
`);

module.exports = db;

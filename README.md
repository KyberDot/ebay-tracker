# 📦 eBay Tracker — Sales & Inventory Platform

A self-hosted platform to track your eBay sales, orders, and inventory in real-time. Connect your eBay seller account via OAuth and get full visibility into your business.

## Features

- **Dashboard** — Revenue charts, top sellers, key metrics (gross revenue, net profit, fees)
- **Sales** — Full transaction history with SKU/code lookup, searchable, filterable
- **Orders** — Grouped order view with line items, tracking numbers, buyer details
- **Inventory** — Track listings with cost price, profit margin, 30-day velocity, notes & tags
- **Auto-Sync** — Pull directly from eBay API (orders, inventory, fulfillment data)
-
---

## 🚀 Quick Start with Docker

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/ebay-tracker.git
cd ebay-tracker
```

### 2. Set up eBay API credentials

Go to [https://developer.ebay.com/my/keys](https://developer.ebay.com/my/keys) and create a production app.

In your eBay app settings, add this **RuName / Redirect URI**:
```
http://YOUR_SERVER_IP:3000/auth/callback
```
(or `http://localhost:3000/auth/callback` for local dev)

### 3. Configure environment

```bash
cp .env.example .env
nano .env  # Fill in your eBay credentials
```

Required variables:
```env
EBAY_CLIENT_ID=your_client_id
EBAY_CLIENT_SECRET=your_client_secret
EBAY_REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=some-long-random-secret
FRONTEND_URL=http://localhost:3000
VITE_API_URL=http://localhost:3001
```

### 4. Run with Docker Compose

```bash
docker compose up -d
```

Open **http://localhost:3000** — sign in with your eBay account and you're done.

---

## 🐙 Deploy via GitHub Actions → GHCR

Push to GitHub and images are automatically built and published to GitHub Container Registry.

### Setup

1. Push this repo to GitHub
2. GitHub Actions will build and push images to `ghcr.io/YOUR_USERNAME/ebay-tracker/backend:latest` and `.../frontend:latest`

### Pull and run on any server

```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Set your repo name
export GITHUB_REPOSITORY=yourusername/ebay-tracker

# Pull latest images
docker compose pull

# Start
docker compose up -d
```

### Using pre-built images in docker-compose.yml

The compose file automatically uses `ghcr.io/${GITHUB_REPOSITORY}/backend:latest` — just set the env var before running.

---

## 🔧 eBay Developer Setup

1. Go to [https://developer.ebay.com/my/keys](https://developer.ebay.com/my/keys)
2. Create a **Production** application
3. Go to **User Tokens** → **Get a Token from eBay via Your Application**
4. Set the **RuName** redirect URI to your server URL + `/auth/callback`
5. Copy the **App ID (Client ID)** and **Cert ID (Client Secret)**

### Required eBay OAuth Scopes (requested automatically)
- `sell.inventory.readonly` — View your listings
- `sell.fulfillment.readonly` — View orders & tracking
- `commerce.identity.readonly` — Read your eBay username

---

## 📁 Project Structure

```
ebay-tracker/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server
│   │   ├── db.js             # SQLite database
│   │   ├── ebay.js           # eBay API client
│   │   └── routes/
│   │       ├── auth.js       # OAuth flow
│   │       ├── sales.js      # Sales sync & queries
│   │       ├── inventory.js  # Inventory sync & CRUD
│   │       └── orders.js     # Order grouping
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/            # Dashboard, Sales, Orders, Inventory
│   │   ├── components/       # Sidebar, SyncButton
│   │   ├── context/          # Auth, Toast providers
│   │   └── utils/            # API client, formatters
│   ├── Dockerfile
│   └── nginx.conf
├── .github/workflows/
│   └── docker-publish.yml    # CI/CD to GHCR
├── docker-compose.yml
└── .env.example
```

---

## 🛠 Local Development (without Docker)

```bash
# Backend
cd backend
npm install
cp ../.env.example .env  # fill in credentials
node src/index.js

# Frontend (separate terminal)
cd frontend
npm install
VITE_API_URL=http://localhost:3001 npm run dev
```

---

## Data Storage

- SQLite database stored in a Docker volume (`ebay_data`)
- Data persists across container restarts
- Database file: `/app/data/ebay_tracker.db`

To backup: `docker compose cp backend:/app/data/ebay_tracker.db ./backup.db`

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `EBAY_CLIENT_ID` | ✅ | eBay App ID from developer portal |
| `EBAY_CLIENT_SECRET` | ✅ | eBay Cert ID from developer portal |
| `EBAY_REDIRECT_URI` | ✅ | Must match RuName in eBay app settings |
| `EBAY_ENV` | — | `production` or `sandbox` (default: production) |
| `SESSION_SECRET` | ✅ | Random string for session encryption |
| `FRONTEND_URL` | — | URL of your frontend (default: http://localhost:3000) |
| `VITE_API_URL` | — | Backend URL baked into frontend at build time |

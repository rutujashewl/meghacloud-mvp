# MeghaCloud MVP — Phase 1

India-hosted, DPDPA-compliant cloud infrastructure platform (demo/prototype build).

This is a working full-stack prototype covering all 8 Phase-1 MVP features:

1. **Authentication** — Email/password + Google Sign-In, JWT sessions, profile
2. **Server Provisioning** — Launch/Start/Stop/Restart/Delete (simulated — no real VM boot)
3. **Pricing** — Real-time monthly cost estimator (Small/Medium/Large)
4. **Dashboard** — Server list, status, region, running cost
5. **Billing** — Auto GST invoicing (18%), PDF download, simulated UPI/Razorpay payment
6. **Monitoring** — CPU/RAM/Disk/Uptime (simulated), 7-day trend chart, incident timeline
7. **Notifications** — In-app bell + simulated email log (server launch/stop, payment)
8. **Settings** — Edit profile, change/set password, delete account (soft delete)

---

## Stack

- **Backend**: Node.js + Express + SQLite (`node:sqlite`, built into Node 22+) + JWT + bcrypt
- **Frontend**: React + Vite + React Router + Recharts + Axios

No external services are required to run this locally — payments, emails, and VM
provisioning are all simulated so you can demo the full flow without any API keys.
Google Sign-In needs a real Client ID to actually work (see below); everything else
runs out of the box.

---

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # already has sane local defaults
npm run dev
```

Runs on **http://localhost:4000**. On first run it creates `backend/data/meghacloud.db`
(SQLite file) automatically — nothing else to configure.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on **http://localhost:5173** and talks to the backend at the URL in `frontend/.env`
(`VITE_API_URL`, defaults to `http://localhost:4000/api`).

Open **http://localhost:5173** in your browser, click "Create Account", and you're in.

---

## Enabling real Google Sign-In (optional)

Google Sign-In is fully wired up but needs a real Client ID to work — without one, the
button just shows disabled and email/password login still works fine.

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an OAuth 2.0 Client ID (type: Web application)
3. Add `http://localhost:5173` under Authorized JavaScript origins
4. Copy the Client ID into **both**:
   - `backend/.env` → `GOOGLE_CLIENT_ID=...`
   - `frontend/.env` → `VITE_GOOGLE_CLIENT_ID=...`
5. Restart both servers

---

## What's simulated (and why)

Per the Technical Architecture Document, several pieces are intentionally simulated
for this MVP rather than wired to real infrastructure — building the real versions is
a separate milestone requiring external accounts/credentials this environment doesn't
have:

| Feature | Simulated as | Real version needs |
|---|---|---|
| VM provisioning | DB row + status flag | OpenStack/KVM hypervisor (see TAD ADR-04) |
| CPU/RAM/Disk metrics | Seeded pseudo-random per server | A real monitoring agent on each VM |
| UPI/Razorpay payment | "Pay Now" flips invoice to paid | Razorpay merchant account + webhook verification |
| Email sending | Logged to `email_log` table | SMTP/SendGrid/SES credentials |

Swapping any of these for the real thing only touches one file each — the pricing
config (`backend/config/pricing.js`), the notify service (`backend/services/notify.js`),
the monitoring route (`backend/routes/monitoring.js`), and the billing pay route
(`backend/routes/billing.js`) — the rest of the app doesn't need to change.

---

## Project structure

```
meghacloud-mvp/
├── backend/
│   ├── config/pricing.js       # server size → price table
│   ├── db/init.js              # SQLite schema (users, servers, invoices, notifications, email_log)
│   ├── middleware/auth.js      # JWT verification
│   ├── routes/
│   │   ├── auth.js             # register/login/google/me/password/delete
│   │   ├── servers.js          # provisioning CRUD + lifecycle actions
│   │   ├── billing.js          # invoices, payment, PDF
│   │   ├── monitoring.js       # simulated metrics
│   │   └── notifications.js    # in-app notification list/read
│   ├── services/notify.js      # fires notification + simulated email together
│   └── server.js               # entry point
└── frontend/
    └── src/
        ├── api/                # one file per backend route group
        ├── components/         # GoogleButton, NotificationBell, ProtectedRoute
        ├── context/AuthContext.jsx
        └── pages/               # Login, Register, Dashboard, LaunchServer, Billing, Monitoring, Profile
```

---

## Known limitations (be upfront about these in demos)

- Single region (Mumbai only) — Delhi/Hyderabad are UI-ready but not wired
- No real VM boot — this proves out the product flow, not the infra layer
- No automated tests yet — everything above was manually verified via curl during
  the build; a proper test suite is a good next investment before a real pilot

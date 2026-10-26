# TrackMaster Hub

Foundation release (Day 1) for the CRM and operations platform described in
[TrackMasterHubPlan.md](TrackMasterHubPlan.md).

Two independent applications share one repository:

- `frontend/` — React + Vite web client
- `backend/` — Node.js + Express API

The landing screen, public routing, shared layout, design system and a live API
health check are in place. No CRM or ERP module has been built yet.

---

## What exists today

- **Landing screen** at `/` with the platform scope, the four role interfaces,
  the end-to-end workflow, and the operating standards taken from the plan.
- **Live API status** in the header, the hero panel and a dedicated `/status`
  page. All three read one shared health snapshot, refreshed every 45 seconds.
- **Reusable layout** (`PublicLayout`, header, footer, brand lockup) and a
  token-based stylesheet layer ready for additional pages and role layouts.
- **Brand implementation** using the supplied TrackMaster logo, including
  browser favicons, Apple touch icon, web manifest and social metadata.
- **Express foundation** with environment configuration, CORS, Helmet,
  request IDs, request logging, JSON 404s and centralised error handling.
- **Health API** at `/api/health`, consumed by the frontend through a
  same-origin `/api` proxy.

Not in this build: authentication, MongoDB/models, customers, sales, renewals,
operations, tickets, billing, reports, tracking API integration, email/WhatsApp
messaging, PDF documents, automated tests, CI and the Android wrapper.

---

## Stack

| Layer     | Choice                                            |
| --------- | ------------------------------------------------- |
| UI        | React 19, React Router 7, Vite 8                  |
| Styling   | Hand-authored CSS with design tokens (no UI kit)  |
| Type      | Archivo (display) and Inter (interface)           |
| API       | Node.js 22, Express 5, Helmet, CORS, dotenv        |
| Icons     | Generated from the official logo with Sharp       |

---

## Structure

```
frontend/
├─ public/                     favicons, manifest, social logo
├─ scripts/
│  └─ generate-brand-assets.mjs
└─ src/
   ├─ assets/brand/            original + optimised logo
   ├─ components/
   │  ├─ brand/                Logo lockup
   │  ├─ layout/               PublicLayout, SiteHeader, SiteFooter
   │  ├─ status/               SystemHealthPanel
   │  └─ ui/                   ApiStatusPill
   ├─ content/site.js          landing copy and navigation data
   ├─ context/                 shared system-health provider
   ├─ hooks/                   useApiHealth, useDocumentTitle
   ├─ lib/                     API client, formatters
   ├─ pages/                   Landing, SystemStatus, NotFound
   ├─ styles/                  tokens, global, layout, pages, landing
   ├─ App.jsx                  route table
   └─ main.jsx                 providers and global imports

backend/
├─ .env.example
└─ src/
   ├─ config/env.js            validated environment configuration
   ├─ middleware/              request id, logging, 404, error handler
   ├─ modules/health/          routes → controller → service
   ├─ routes/index.js          API router registry
   ├─ app.js                   Express assembly
   └─ server.js                listener and graceful shutdown
```

Future modules follow the existing `modules/<feature>` pattern and mount in
`backend/src/routes/index.js`. Authenticated role interfaces will use their own
layout under `frontend/src/` without changing the public layout.

---

## Getting started

Requires Node.js 20.19+ or 22.12+ (developed on Node 22.19) and npm.

### Backend

```bash
cd backend
npm install
cp .env.example .env      # optional; the defaults match local development
npm run dev               # http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to
`http://localhost:4000`, so the browser never needs CORS in development.

### Other commands

```bash
cd frontend && npm run build      # production build in frontend/dist
cd frontend && npm run preview    # local preview on :4173 (proxies /api too)
cd frontend && npm run brand:icons
cd backend && npm start            # production listener, no file watching
```

### Configuration

| File                        | Variable            | Purpose                                         |
| --------------------------- | ------------------- | ----------------------------------------------- |
| `backend/.env`              | `NODE_ENV`          | `development`, `test`, `staging`, `production`  |
|                             | `API_PORT`          | API port (default `4000`); wins over `PORT`      |
|                             | `CLIENT_ORIGIN`     | Comma-separated allowed browser origins         |
| `frontend/.env` (optional)  | `VITE_API_BASE_URL` | Absolute API origin when the apps are split     |

`API_PORT` takes precedence because some hosts pre-set `PORT` for their own
tooling. Local `.env` files are ignored by git; `.env.example` files are
committed.

A deployed split-origin setup must set `VITE_API_BASE_URL` and add the web
origin to `CLIENT_ORIGIN`. When both apps share an origin behind a reverse
proxy, no variable is required.

---

## API

### `GET /`

```json
{
  "name": "TrackMaster Hub API",
  "version": "0.1.0",
  "health": "/api/health"
}
```

### `GET /api/health`

Returns `200` with `Cache-Control: no-store`.

```json
{
  "status": "ok",
  "service": {
    "name": "trackmaster-hub-api",
    "version": "0.1.0",
    "environment": "development"
  },
  "uptimeSeconds": 42,
  "startedAt": "2026-10-26T10:03:05.376Z",
  "timestamp": "2026-10-26T10:03:47.120Z",
  "checks": { "api": "operational" }
}
```

Unknown routes return JSON in the same error shape:

```json
{
  "error": {
    "code": "ROUTE_NOT_FOUND",
    "message": "No route matches GET /api/unknown.",
    "requestId": "…"
  }
}
```

Every response carries `X-Request-Id` for correlation with server logs.

---

## Routes

| Path       | Page                                                        |
| ---------- | ----------------------------------------------------------- |
| `/`        | Landing screen with live API panel                           |
| `/status`  | Live API health details and planned checks                   |
| `*`        | Not-found screen                                             |

Section links use `/#platform`, `/#roles`, `/#workflow` and `/#standards`; the
layout scrolls to the matching element after client-side navigation.

---

## Brand

The official artwork is preserved at
`frontend/src/assets/brand/trackmaster-logo-original.png`. The app imports an
optimised 512 px derivative, and every browser icon is generated from the same
source:

- `favicon-32.png`, `favicon-192.png`, `favicon-512.png`
- `apple-touch-icon.png` (flattened onto the interface paper colour)
- `public/brand/trackmaster-logo.png` for social metadata

To replace the logo later, overwrite the original file and run
`npm run brand:icons` in `frontend/`. Nothing else needs to change.

Palette sampled from the logo and defined in `frontend/src/styles/tokens.css`:
ink `#12151a`, TrackMaster red `#d7131b`, paper `#f6f5f1`, white surfaces,
hairline `#e0ddd5`. Dark sections use `#101317`.

---

## Verification performed

- `npm run build` completes with no errors; production preview serves `/`,
  `/status`, the favicon and the proxied health endpoint.
- `GET /api/health` returns `200` with the expected payload; `GET /api/unknown`
  returns structured `404` JSON; the CORS preflight for the web origin returns
  `204`.
- Browser checks: landing and status pages render live data; header/hero/status
  all report `API online`; offline state appears when the API is stopped, and
  recovery works on the next poll.
- Mobile menu opens and closes, closes on navigation, and exposes `Escape`.
- Hash navigation resolves the correct section target; per-route document
  titles update.
- No horizontal overflow at 1440, 1024, 768, 390 or 360 px; the logo, generated
  favicons and bundled fonts load successfully.
- No console errors or failed application requests; the only aborted request is
  React StrictMode's deliberate double-mount in development.

There is no automated test suite or CI yet. Checks were run manually against the
running apps.

---

## Next phase (not started)

Per the plan, requirements and live tracking API discovery precede deeper
implementation. The next build would cover Phase 2: MongoDB connection, user and
customer models, authentication, role/ownership enforcement, duplicate checks
and audit foundations — still without building the CRM/ERP screens themselves.

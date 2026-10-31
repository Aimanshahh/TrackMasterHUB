# TrackMaster Hub

Vehicle CRM and operations platform, built to the scope in
[TrackMasterHubPlan.md](TrackMasterHubPlan.md). Two applications share one
repository:

- `frontend/` — React + Vite web client
- `backend/` — Node.js + Express + MongoDB API

Everything shown in the interface comes from MongoDB. There is no seed data and
no client-side fallback content: an empty collection produces an empty state, and
a failed request produces an error.

---

## What exists today

Status summary: **admin, operations and manager are feature-complete for the
current scope, and the salesperson desk is functional end to end.** Package
pricing, price approvals, invoices and partial payments are live. Nothing in the
product is demo data.

### Foundation

- React 19 + Vite 8 client, Express 5 API, Mongoose 8 against MongoDB Atlas.
- Hand-authored design system (tokens, layout, workspace and module stylesheets)
  with the official TrackMaster logo, favicons, manifest and social metadata.
- Session authentication with bcrypt password hashes, httpOnly session cookies,
  server-side session records and a seven-day expiry.
- Server-enforced roles: `admin`, `salesperson`, `manager`, `operations`. The
  URL never grants access by itself — every route checks the session role and
  every record query is scoped by ownership.
- Health endpoint that reports API status and database connectivity separately.

### Admin workspace (`/admin`)

- Overview with live record counts and recent recorded activity.
- Customer register: search, category/priority filters, sorting, add customer,
  customer record page, empty/loading/error states.
- Follow-ups, sales (awaiting the sales workflow), operations queue, complaints,
  reports, user access, activity log, settings.
- Pricing: the admin sets the Basic, Standard and Premium package rates, plus the
  wording the salesperson sees. A package without a rate cannot be quoted.
- Approvals: every installation quoted below the package rate arrives here for a
  decision, with the discount, the salesperson's reason and an audit trail.
- Money records: the same invoice and payment ledger the manager desk uses, so the
  admin can answer a billing question without switching accounts.
- User access is where salesperson, manager and operations accounts are created.

### Operations workspace (`/operations`)

- Overview with open jobs, completed jobs, available devices and SIMs.
- Work queue: push-in requests, technician assignment, scheduling, device IMEI
  and SIM allocation, status history, cancellation releases stock.
- Complaints desk with status transitions and resolution notes.
- Inventory: device stock by IMEI and SIM stock, per station, with assignment to
  technicians and an out-of-service state (no “retirement” wording).
- Technicians: create and manage field staff, see how many devices each holds
  and how many are already fitted.
- Station stock panel that flags any station below three available devices, and
  a technician stock panel that flags a technician below three held devices.
  Both raise in-app notifications for the operations desk and admins, throttled
  to one alert per station/technician per 12 hours.
- Low stock is computed from records, never stored as a fake figure.

### Salesperson workspace (`/salesperson`)

Mobile-first: a bottom tab bar on phones, the full sidebar on desktop.

- “My day”: own customer count, overdue follow-ups, open requests, open tickets,
  the next follow-ups to make and the latest status updates.
- My customers: search, priority and follow-up filters, sorting, add customer.
- Customer intake: choose **New installation** or **Follow-up**. A new
  installation captures vehicle name, registration, station and the requested
  installation date and time, then pushes the request straight into the
  operations queue. The slot is a request, not a confirmation: operations still
  assigns the technician and may move the appointment. The signed-in
  salesperson is recorded as owner by the backend.
- Customer record: profile, notes, follow-up logging (date + note), requests and
  tickets for that customer, with “New installation” and “Log complaint” actions.
- Follow-ups grouped into overdue / today / next seven days / later / no date,
  with tap-to-call.
- Installation requests with status, technician, IMEI, SIM, schedule and the
  latest history entry.
- Complaints with status, resolution and full status history.
- Sales & renewals is an explicit “not connected yet” page — no invented
  numbers.
- Notifications: when operations changes the status of a request or ticket the
  salesperson logged, the backend creates a notification for that owner. The bell
  in the top bar and the “Latest updates” panel read the same records.
- Every screen reads from the API on load and again after each mutation, so a
  status change made by operations appears on the salesperson desk without a
  manual reload.

### Manager workspace (`/manager`)

The billing authority, built as a ledger rather than a card dashboard.

- Overview: money collected this month, outstanding balance, invoices still to be
  raised from finished installations, overdue invoices and briefings waiting on
  the manager. A one-click “Draft invoice” turns a completed installation into an
  invoice at the price it was actually sold for.
- Customer lookup: every customer, searchable by name, phone, email, company or
  category, filtered by account state, with owner, installation count and
  activation state.
- Customer account: profile, per-vehicle installation details (station,
  technician, IMEI, SIM, scheduled/completed dates, package and sold price),
  invoices, the full payment ledger and complaints.
- Security briefing: CNIC, date of birth, E-PIN, secondary user and geofence
  address. Saving a complete briefing is what activates the account — a finished
  installation alone never does. These fields are visible only here and to the
  admin; they never appear in lists, notifications or the salesperson app.
- Invoices: draft, issue and cancel. Amounts are fixed at issue; the invoice
  cannot be edited afterwards, and a cancelled invoice with money against it is
  refused.
- Payments: **partial payments are first-class.** Each instalment is its own
  record with amount, method, date and bank/cheque reference; the invoice shows a
  settlement bar and the remaining balance. Paying more than the balance is
  rejected, and both instalments stay visible on the same invoice.
- Payments ledger: filter by search, method and date range, with the total for the
  current view.
- Reports: six-month invoiced-versus-received series, the money position and the
  operational counts behind it, all counted from stored records.
- Complaints (read-only) and settings.

---

## Stack

| Layer    | Choice                                                     |
| -------- | ---------------------------------------------------------- |
| UI       | React 19, React Router 7, Vite 8                           |
| Styling  | Hand-authored CSS with design tokens (no UI kit)            |
| Type     | Archivo (display) and Inter (interface)                     |
| API      | Node.js 20.19+/22, Express 5, Helmet, rate limiting, dotenv |
| Database | MongoDB Atlas via Mongoose 8                                |
| Auth     | bcrypt hashes, httpOnly session cookie, server-side sessions |
| Icons    | Generated from the official logo with Sharp                 |

---

## Structure

```
frontend/
├─ public/                     favicons, manifest, social logo
└─ src/
   ├─ app/                     navigation, workspace definitions, role rules
   ├─ components/
   │  ├─ app/                  layout, sidebar, topbar, bell, tabs, empty states
   │  ├─ brand/                Logo lockup
   │  ├─ customers/            customer table and drawer
   │  ├─ operations/           jobs, inventory, technicians, stock panels
   │  ├─ salesperson/          intake, request and complaint drawers
   │  └─ status/, ui/          health panel and status pill
   ├─ context/                 auth and system-health providers
   ├─ hooks/                   useCustomers, useDashboard, useSalesperson, …
   ├─ lib/                     API client and formatters
   ├─ pages/
   │  ├─ app/                  admin pages
   │  ├─ operations/           operations pages
   │  ├─ salesperson/          salesperson pages
   │  └─ auth/                 sign-in
   ├─ styles/                  tokens, global, layout, app-shell, workspace,
   │                           operations, salesperson
   └─ App.jsx                  route table

backend/
├─ .env.example
└─ src/
   ├─ config/                  env, database connection, constants, error codes
   ├─ middleware/              session, auth, errors, request id, logging
   ├─ models/                  User, Session, Customer, Job, Complaint,
   │                           Device, Sim, Technician, Notification, Activity
   ├─ modules/
   │  ├─ auth/                 login, logout, session, first-run bootstrap
   │  ├─ users/                account creation and role changes
   │  ├─ customers/            list, read, create, update (owner-scoped)
   │  ├─ operations/           jobs, stock, technicians, devices, SIMs
   │  ├─ complaints/           ticket queue and status changes
   │  ├─ notifications/        per-user notification records
   │  ├─ salesperson/          own summary and own requests
   │  ├─ dashboard/, activity/ admin counts and audit trail
   │  └─ health/               API and database checks
   ├─ routes/index.js          module registry
   ├─ app.js                   Express assembly
   └─ server.js                Mongo connect, listener, graceful shutdown
```

---

## Getting started

Requires Node.js 20.19+ or 22.12+, npm, and a MongoDB connection string.

### Backend

```bash
cd backend
npm install
cp .env.example .env     # then fill MONGO_URI and JWT_SECRET
npm run dev              # http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

Open <http://localhost:5173>. Vite proxies `/api` to the Express server, so the
browser never needs CORS in development.

### Other commands

```bash
cd frontend && npm run build      # production build in frontend/dist
cd frontend && npm run preview    # local preview on :4173
cd frontend && npm run brand:icons
cd backend && npm start           # production listener, no file watching
```

### Configuration

| File           | Variable                  | Purpose                                        |
| -------------- | ------------------------- | ---------------------------------------------- |
| `backend/.env` | `NODE_ENV`                | `development`, `test`, `staging`, `production` |
|                | `API_PORT`                | API port (default `4000`); wins over `PORT`    |
|                | `CLIENT_ORIGIN`           | Comma-separated allowed browser origins        |
|                | `MONGO_URI`               | MongoDB connection string                      |
|                | `JWT_SECRET`              | Signing secret for session tokens              |
|                | `SESSION_TTL_DAYS`        | Session lifetime, default `7`                  |
| `frontend/.env`| `VITE_API_BASE_URL`       | Absolute API origin when the apps are split    |

`.env` files are ignored by git; `.env.example` is committed. A split-origin
deployment must set `VITE_API_BASE_URL` and add the web origin to
`CLIENT_ORIGIN`.

### Accounts

There is no self-signup. Accounts are created in **Admin → Users** (or through
`POST /api/users` as an admin). If the `users` collection is empty, `/sign-in`
offers a one-time first-admin setup instead.

Current development accounts in the local database:

| Role        | Email                      |
| ----------- | -------------------------- |
| Admin       | `Admin@Trackmaster.com`    |
| Salesperson | `sales@trackmaster.com`    |
| Manager     | `kehkashan@trackmaster.com`|
| Operations  | `mahad@trackmaster.com`    |

Passwords are never stored in the repository; they live only as bcrypt hashes in
MongoDB. Reset a forgotten password by removing the user document and signing in
again through first-run setup, or by having an admin recreate the account.

---

## API

All responses are JSON. Authenticated routes use the `session` httpOnly cookie.
Every response carries `X-Request-Id`.

| Method | Path                              | Access                     |
| ------ | --------------------------------- | -------------------------- |
| GET    | `/api/health`                     | public                     |
| POST   | `/api/auth/login`                 | public                     |
| POST   | `/api/auth/logout`                | public — clears the cookie |
| GET    | `/api/auth/me`                    | session                    |
| GET    | `/api/auth/setup-status`          | public                     |
| POST   | `/api/auth/bootstrap`             | only when no users exist   |
| GET    | `/api/users`                      | admin                      |
| POST   | `/api/users`                      | admin                      |
| PATCH  | `/api/users/:id/role`             | admin                      |
| GET    | `/api/customers`                  | session, owner-scoped      |
| GET    | `/api/customers/:id`              | owner or admin             |
| POST   | `/api/customers`                  | session, owner = session   |
| PATCH  | `/api/customers/:id`              | owner or admin             |
| GET    | `/api/dashboard`                  | admin                      |
| GET    | `/api/activity`                   | admin                      |
| GET    | `/api/operations/summary`         | admin, operations          |
| GET    | `/api/operations/stock-by-station`| admin, operations          |
| GET    | `/api/operations/stock-by-technician` | admin, operations      |
| GET    | `/api/operations/jobs`            | admin, operations          |
| POST   | `/api/operations/jobs`            | admin, operations, salesperson |
| PATCH  | `/api/operations/jobs/:id`        | admin, operations          |
| GET    | `/api/operations/technicians`     | admin, operations          |
| POST   | `/api/operations/technicians`     | admin, operations          |
| PATCH  | `/api/operations/technicians/:id` | admin, operations          |
| GET    | `/api/operations/devices`         | admin, operations          |
| POST   | `/api/operations/devices`         | admin, operations          |
| PATCH  | `/api/operations/devices/:id`     | admin, operations          |
| GET    | `/api/operations/sims`            | admin, operations          |
| POST   | `/api/operations/sims`            | admin, operations          |
| PATCH  | `/api/operations/sims/:id`        | admin, operations          |
| GET    | `/api/complaints`                 | session, owner-scoped      |
| POST   | `/api/complaints`                 | admin, operations, salesperson |
| PATCH  | `/api/complaints/:id`             | admin, operations          |
| GET    | `/api/notifications`              | session, own records       |
| PATCH  | `/api/notifications/:id/read`     | session, own records       |
| POST   | `/api/notifications/read-all`     | session, own records       |
| GET    | `/api/salesperson/summary`        | salesperson                |
| GET    | `/api/salesperson/jobs`           | salesperson                |
| GET    | `/api/packages`                   | session                    |
| PATCH  | `/api/packages/:key`              | admin                      |
| GET    | `/api/approvals`                  | admin, manager             |
| POST   | `/api/approvals/:id/decision`     | admin                      |
| GET    | `/api/billing/summary`            | admin, manager             |
| GET    | `/api/billing/series`             | admin, manager             |
| GET    | `/api/billing/invoices`           | admin, manager             |
| POST   | `/api/billing/invoices`           | admin, manager             |
| POST   | `/api/billing/invoices/:id/issue` | admin, manager             |
| POST   | `/api/billing/invoices/:id/cancel`| admin, manager             |
| GET    | `/api/billing/invoices/:id/payments` | admin, manager          |
| POST   | `/api/billing/invoices/:id/payments` | admin, manager — one instalment |
| GET    | `/api/billing/payments`           | admin, manager             |
| GET    | `/api/manager/summary`            | admin, manager             |
| GET    | `/api/manager/customers`          | admin, manager             |
| GET    | `/api/manager/customers/:id`      | admin, manager             |
| PATCH  | `/api/manager/customers/:id/briefing` | admin, manager         |
| GET    | `/api/manager/billing-queue`      | admin, manager             |

Health response:

```json
{
  "status": "ok",
  "service": { "name": "trackmaster-hub-api", "version": "0.1.0", "environment": "development" },
  "uptimeSeconds": 42,
  "checks": { "api": "operational", "database": "operational" }
}
```

Errors share one shape:

```json
{ "error": { "code": "FORBIDDEN", "message": "You are not allowed to open this screen.", "requestId": "…" } }
```

---

## Routes

| Path                   | Workspace                                     |
| ---------------------- | --------------------------------------------- |
| `/sign-in`             | Session sign-in (no self-signup)              |
| `/admin`               | Admin overview                                |
| `/admin/customers`     | Customer register                             |
| `/admin/customers/:id` | Customer record                               |
| `/admin/follow-ups`    | Follow-ups                                    |
| `/admin/sales`         | Sales placeholder                             |
| `/admin/operations`    | Operations queue and stock                    |
| `/admin/complaints`    | Complaints                                    |
| `/admin/reports`       | Reports placeholder                           |
| `/admin/pricing`       | Package rates set by the admin                |
| `/admin/approvals`     | Prices quoted below the package rate          |
| `/admin/money`         | Invoices and payments (read and act)          |
| `/admin/users`         | Account creation and role review              |
| `/admin/activity`      | Activity log                                  |
| `/admin/settings`      | Workspace settings                            |
| `/operations`          | Operations overview                           |
| `/operations/queue`    | Work queue                                    |
| `/operations/complaints` | Complaints desk                             |
| `/operations/inventory`| Device and SIM stock                          |
| `/operations/technicians` | Technicians and their held stock            |
| `/operations/reports`  | Operations reports                            |
| `/operations/settings` | Operations settings                           |
| `/salesperson`         | Salesperson “My day”                          |
| `/salesperson/customers` | Own customers                               |
| `/salesperson/customers/:id` | Customer record                        |
| `/salesperson/follow-ups` | Follow-up plan                             |
| `/salesperson/requests` | Installation requests                        |
| `/salesperson/complaints` | Logged complaints                          |
| `/salesperson/sales`   | Sales placeholder                             |
| `/salesperson/settings`| Account and security                          |
| `/manager`             | Manager overview and billing queue            |
| `/manager/customers`   | Global customer lookup                        |
| `/manager/customers/:id` | Customer account, briefing and money        |
| `/manager/invoices`    | Invoice register, issue and settle            |
| `/manager/payments`    | Payment ledger                                |
| `/manager/complaints`  | Complaint queue (read-only)                   |
| `/manager/reports`     | Invoiced versus received, money position      |
| `/manager/settings`    | Account and data-protection notes             |
| `/status`              | Public system status                          |

Opening a workspace that does not match the signed-in role redirects to that
role's own home. Signed-out visitors are sent to `/sign-in` with a return path.

`/sign-in` always renders, even when a session is open. It shows who is signed in
with a “Continue to workspace” link, and signing in with another account replaces
the session — the previous cookie is invalidated server-side. This is what makes
switching between admin, manager, operations and salesperson accounts reliable in
one browser without clearing cookies.

---

## Brand

The official artwork is preserved at
`frontend/src/assets/brand/trackmaster-logo-original.png`. The app imports an
optimised 512 px derivative and every browser icon is generated from the same
source (`favicon-32/192/512`, `apple-touch-icon`, social logo). To replace the
logo, overwrite the original and run `npm run brand:icons`.

Palette sampled from the logo (`frontend/src/styles/tokens.css`): ink `#12151a`,
TrackMaster red `#d7131b`, paper `#f6f5f1`, hairline `#e0ddd5`, night `#101317`.

---

## Verification performed

- `npm run build` completes with no errors.
- Backend starts, connects to MongoDB Atlas, and `/api/health` reports both
  `api` and `database` as operational.
- Sign-in with an admin session works; a signed-out request to `/admin` redirects
  to `/sign-in`, and a salesperson session gets `403` from operations endpoints.
- Customer list, create (phone required, email optional) and update were tested
  against the live database through the API and through the salesperson UI.
- New installation intake creates the customer (owner = signed-in salesperson)
  and the operations job in one flow.
- Operations assignment of a technician to that job produced an
  `installation.status_changed` notification addressed to the salesperson; a
  complaint status change produced `complaint.status_changed`.
- Salesperson summary, own customers, own jobs and notifications were checked
  with the real records, then all test records were deleted. The database is
  left with accounts only — no customers, jobs, complaints, devices or
  technicians.
- Salesperson workspace checked at 390 px and 1440 px: no horizontal overflow,
  bottom tab bar on phones, sidebar on desktop, drawers usable on both.
- Empty states verified for customers, follow-ups, queue, complaints and stock.
- Stock alerts recalculated from live records: a station or technician dropping
  below three available devices raises one notification per 12 hours, and the
  bell, the operations panels and the notification list all agree.
- Salesperson desk re-checked at 390 px and 1440 px after the bell and greeting
  changes; no layout regressions on the admin or operations screens.
- Pricing and approvals: a Standard package rate was set, an installation was
  quoted below it, the request reached the admin approval queue, and approving it
  released the installation to operations. The package and its rate were removed
  after the test, so no invented price is left in the database.
- Manager and billing flow, end to end against MongoDB with a temporary record
  (since deleted): customer created → installation completed with technician,
  IMEI and SIM → invoice drafted at the sold price → payment refused before
  issue → half payment left the invoice part paid → an overpayment was rejected →
  the second half settled it → both instalments stayed as separate payment
  records → customer was inactive after installation and became active only when
  the security briefing was saved → an incomplete briefing was rejected.
- Role enforcement: a salesperson session received `403` on the manager summary,
  the money endpoints and package pricing.
- Session switching: signing in as another role from `/sign-in` while a session
  was open replaced the cookie and opened the new role's workspace; a new
  `/api/auth/me` confirmed the change. Logout ended the session, and the same
  browser could sign straight back in.
- Manager screens and the admin money screen were opened in the browser against
  live records at 1440 px and 390 px: no console errors, no page-level horizontal
  overflow (wide ledgers scroll inside their own frame), and every empty state
  reads as an empty state rather than a zero.
- All verification records (customer, job, invoice, two payments, technician,
  device, SIM, approvals, notifications and the temporary accounts) were deleted
  afterwards. The database holds staff accounts only.

Not verified yet: sales/renewals workflow, complaint email/WhatsApp delivery,
dialer call import, automated tests, CI.

---

## Remaining work

Recommended order for the next sessions (detailed in
[TrackMasterHubPlan.md](TrackMasterHubPlan.md) section 19):

1. Call history imported from the business dialer (provider call id, direction,
   duration, disposition, agent), matched to customers by phone number. Staff do
   not hand-log calls, and the report says “not connected” until a dialer is
   wired up rather than showing a zero.
2. Customer history report: one printable record per customer spanning the
   installation, devices and SIMs, follow-ups, complaints and their resolutions,
   call history and totals.
3. Complaint customer messaging: email through Nodemailer/SMTP and WhatsApp once
   a provider is approved, with per-channel delivery records so a failed send
   never blocks the status change.
4. Admin customer record brought to parity with the manager/salesperson record
   (timeline, requests, tickets) — today it is only a field list.
5. Sales and renewals for the salesperson: quotation history and renewal
   pipeline on top of the existing packages, pricing and approvals.
6. Documents: printable/PDF invoices and certificates, plus refunds, credit notes
   and invoice numbering rules for production.
7. Customer records: a `Vehicle` collection so one customer can hold several
   vehicles with their own installation history, instead of reading vehicles off
   the job records.
8. Activity logging for operations, complaints and stock movements (today only
   customer and account events are recorded).
9. Live tracking API discovery and integration.
10. Automated tests and CI.
11. Salesperson Android APK wrapper once the web workspace is signed off.

## Known gaps

- Mongo connects to the database named in `MONGO_URI`; keep the database name in
  the connection string so data does not land in the driver default (`test`).
- `JWT_SECRET` in the local `.env` is a development value; set a 32+ character
  secret before any deployment.
- Activity logging is not yet written by every module. Customer creation, package
  pricing, approvals, invoices, payments and briefings are logged; job status
  changes, stock movements and complaint updates are not.
- Invoices have no printable/PDF output yet and no refund or credit-note path. A
  cancelled invoice deliberately keeps its reference, and an invoice with money
  against it cannot be cancelled.
- Subscription status and live GPS connectivity are not shown anywhere: the
  tracking API has not been discovered or connected, and the UI says nothing
  rather than inventing a state.

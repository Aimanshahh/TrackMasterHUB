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

Status summary: **all five workspaces work end to end** — admin, operations,
salesperson, manager and the technician field portal. Package pricing and minimum
prices, price approvals, sales and renewals, hot leads, agent commissions,
invoices with partial payments, certificates, complaints with customer messaging,
call history, legacy data import, WhatsApp templates, the Shezz Traders device
fetch, the technician installation workflow and the technician payment ledger are
live. Nothing in the product is demo data.

### Added since the first release

- **Legacy import.** Upload the old Excel sheet, map its columns (including App
  Login and App Password), review the plan, then confirm. Customers are created
  or matched by phone, a vehicle is a `new_installation` record keyed by its
  plate, and old history becomes dateless timeline events marked as legacy.
  Customers with many vehicles become *Fleet*, single-vehicle customers
  *Individual*; two devices on one plate (`(LOC)` / `(IMB)`) are grouped as one
  vehicle with two devices.
- **15-day inactivity rule** for tracked vehicles, and a customer **timeline**
  that merges installations, inspections, AMC payments, notes, WhatsApp messages
  and imported history.
- **WhatsApp.** A separate gateway (`whatsapp-gateway/`) sends messages; the Hub
  posts to it, records every message with its delivery result and never blocks a
  status change when a send fails.
- **Operations customer desk.** Search-first customer screen (nothing loads until
  you search by name, phone or VRN), a customer profile with a compact vehicle
  drawer, and customer app login / password with a show-hide toggle.
- **WhatsApp template sender.** Pick a customer and a template, see the message
  with the customer's details filled in, send it, and a timeline event is added.
  Templates are stored in the database; *Helpline Numbers* and *Login Details* are
  built in and the desk can add its own.
- **Shezz Traders device fetch.** One read-only feed on Shezz lists the devices
  handed to technicians; the Hub matches technician names and assigns the stock.
- **Sales and renewals** for the salesperson and the admin (see below).
- **Quotations.** Priced offers with a validity date and printed terms: draft,
  sent, accepted, rejected or expired, with version history and a printable A4
  sheet. A salesperson's view is limited to their own customers.
- **Two numbers per package.** The admin sets a standard rate (what it sells for)
  and a minimum price (a hard floor). A discount below the rate needs approval; a
  quote below the floor is refused.
- **Technician portal.** A fifth role with its own mobile-first workspace: today's
  installations, the technician's own device and SIM stock, device selection that
  must match the issued stock digit for digit, the four installation tests, engine
  kill requested through operations, submission for approval, and their own
  earnings and payments.
- **Today screen** for operations, a short list of what needs doing, and a
  simpler, quieter top bar on every workspace.

### Foundation

- React 19 + Vite 8 client, Express 5 API, Mongoose 8 against MongoDB Atlas.
- Hand-authored design system (tokens, layout, workspace and module stylesheets)
  with the official TrackMaster logo, favicons, manifest and social metadata.
- Session authentication with bcrypt password hashes, httpOnly session cookies,
  server-side session records and a seven-day expiry.
- Server-enforced roles: `admin`, `salesperson`, `manager`, `operations`,
  `technician`. The URL never grants access by itself — every route checks the
  session role and every record query is scoped by ownership. A technician login
  is bound to one technician record, so it can only ever read its own
  installations, stock and earnings.
- Health endpoint that reports API status and database connectivity separately.

### Admin workspace (`/admin`)

- Overview with live record counts and recent recorded activity.
- Customer register: search, category/priority filters, sorting, add customer,
  customer record page, empty/loading/error states.
- Follow-ups, operations queue, complaints, reports, user access, activity log,
  settings.
- Sales: every sale across all salespeople (this month and all time), a table by
  salesperson, price approvals waiting for a decision, and the renewals coming
  due, all counted from stored records.
- Quotations: every priced offer given to a customer, filterable by Draft, Sent,
  Accepted, Rejected or Expired, with search by reference, customer or
  registration, send / record the customer's answer / revise, and a printable A4
  quotation. A quote is fixed once sent: a price change becomes a new version and
  the earlier figures stay in its history.
- WhatsApp messages: send to one customer or to everyone with a phone number,
  with a Sent / Failed result for each message.
- Pricing: the admin sets two numbers per package — the **standard rate** and the
  **minimum price** (floor) — plus the wording the salesperson sees. The rate is
  what the package sells for; a discount below it becomes an approval. The floor
  is hard: a quote under it is refused by the backend, and the error names the
  floor. Leaving the minimum empty means the rate is the floor. A package with no
  rate cannot be quoted at all.
- Approvals: every installation quoted below the package rate arrives here for a
  decision, with the discount, the salesperson's reason, the minimum price that
  applied (flagged if the quote was under a floor raised after the sale) and an
  audit trail.
- Money records: the same invoice and payment ledger the manager desk uses, so the
  admin can answer a billing question without switching accounts.
- User access creates salesperson, manager, operations and technician accounts.
  A technician login is created together with its technician record, so the two
  can never drift apart.
- Technician payments: installation rates per technician (normal, redo,
  additional), earned amounts calculated from approved installations, recorded
  payments and the outstanding balance, all read from the earning and payment
  records rather than a stored total. Reversing an earning keeps the record and
  its reason.
- Agent commissions on the Sales screen: every agent-assisted sale, the commission
  committed, what is still pending and what has been paid.

### Operations workspace (`/operations`)

- **Today**: four numbers (tasks waiting for a technician, tasks being worked on,
  open complaints, technicians low on devices) that each open the right screen,
  and one list of what needs attention.
- **Customers**: search-first, with a profile that shows contact details, the
  customer's app login and password (hidden until revealed), a *View vehicles*
  drawer, certificates, the timeline and complaints. Money records and the
  manager's security briefing are not shown here.
- **WhatsApp**: choose a customer and a template, check the filled-in message,
  send. *Add template* lets the desk write more, using the variables
  `[Customer Name]`, `[Customer Phone]`, `[Helpline Number]`, `[Login Email]` and
  `[Password]`. A message cannot be sent while a value it needs is missing, and
  the password is masked in the saved message log.
- **Fetch from Shezz** on the Inventory screen: reads the devices Shezz Traders
  handed to technicians, matches each name to a technician created here (ignoring
  the word “Technician”, case and spacing), asks for confirmation on close
  matches, remembers hand-picked spellings, and never moves a device that is
  already fitted to a vehicle.
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
- **Testing review**: installations submitted by technicians, with the four test
  results and the tracking-portal reading beside them. Operations approves,
  rejects or asks for a retest, records the engine kill and restore, and can move
  a schedule or the address; every change is kept with its previous value and the
  technician is notified. Approval closes the installation, marks the device and
  SIM installed, creates the technician's earning from their current rate and, for
  Standard or Premium, raises a microphone assignment task.
- **Microphones**: the one-way microphone number inventory, the vehicles still
  waiting for a number, assignment and release. A number can only be active on one
  vehicle, and Basic installations never ask for one.
- Low stock is computed from records, never stored as a fake figure.

### Salesperson workspace (`/salesperson`)

App-style: no sidebar, a bottom tab bar at every width, and an avatar menu for Follow-ups and settings.

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
- Sales & renewals: the salesperson's own sales this month and overall, sales
  waiting for price approval (with how far below list each was quoted), a list of
  their customers' vehicles whose yearly plan has expired or ends within 30 days,
  and the package price list. Only their own figures are returned; the server
  takes the salesperson from the session.
  On a phone the screen switches to a thumb-friendly layout: one headline number
  for the month, two quick chips, and big tabs (Renewals, My sales, Prices) over
  card lists, with one-tap Call and WhatsApp buttons on every renewal.
- **Quotations**: the offers the salesperson has written, with the price each one
  holds, the validity date and whether the customer answered. They see quotations
  for their own customers only; the service resolves the portfolio from the
  session.
- **Hot leads**: customers who agreed to buy but are not installed yet, marked on
  the existing customer record (never a duplicate), with lead status, delay
  reason, expected installation date and next follow-up. Closing a lead leaves the
  customer untouched.
- **Agent-assisted sales**: the intake form can record Direct or Agent, with the
  agent's name, phone, commission and remarks. Commission is tracked separately
  from sales performance and technician pay, and is never marked paid automatically.
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

### Technician portal (`/technician`)

Phone-first: one column, a bottom tab bar, and no sidebar on small screens. The
login is linked to a single technician record, so every query is scoped to that
technician by the server.

- **Today**: the greeting, the day's installations with their time and station,
  open/awaiting-approval/stock counts, and what is coming up.
- **Installations**: open, completed, cancelled or all, each with its four test
  states. Opening one shows the customer, vehicle, schedule, address, package and
  the operations note — all read-only.
- **Device and SIM**: the technician types the IMEI and SIM. Both are compared with
  their own issued stock, and a single wrong digit is rejected with the closest
  number named. A device reserved for another installation, or one already fitted,
  is refused; the server never accepts a device from another technician.
- **Tests read from the portal**: geolocation, battery disconnect and ignition
  ON/OFF are read from the technician-stock tracking portal by the IMEI the
  technician confirmed (Operations creates that device's user there). "Check now"
  refreshes the portal and records what it sees: ignition is verified once both ON
  and OFF have been seen, battery once both disconnected and reconnected have been
  seen, and location once a position is reported and the technician adds where the
  device was fitted. Readings older than `PORTAL_READING_FRESH_MINUTES` never count.
  A manual pass is accepted only when the portal does not report that measure.
- **Engine kill**: only for Standard, Premium and Customize packages (Basic and
  Personal have none). The technician calls Operations, requests the test, or notes
  that the vehicle cannot take an engine kill. Operations checks it on the portal
  and confirms the restore at approval.
- **Customer app login**: on approval the customer gets `<VRN>@<domain>` (for
  example `VRN-567@trackmaster.pk`) with the shared starting password from
  `CUSTOMER_APP_DEFAULT_PASSWORD`, only when no login exists yet.
- **Submit**: blocked until the device, SIM and required tests are in place. After
  submission the screen waits for operations; approval or a retest request appears
  as a notification and as a banner on the installation.
- **My stock**: devices and SIMs issued to the technician, with their state and the
  date they were fitted.
- **Earnings**: the applicable rate, total earned, payments received, the
  outstanding balance, and the earning and payment history.

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
|                | `TRACKING_API_URL`, `TRACKING_API_HASH` | GPSWOX tracking server and its API hash (server only). Left empty in `.env.example` on purpose: the installation tests read this portal, and the hash is never sent to the browser. |
|                | `PORTAL_1_*`, `PORTAL_2_*` | Extra tracking portals queried in turn        |
|                | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Complaint emails; empty `SMTP_HOST` sends nothing |
|                | `WHATSAPP_GATEWAY_URL`    | The gateway's `/api/send-update` address       |
|                | `WHATSAPP_GATEWAY_API_KEY`| Must equal `WEBHOOK_API_KEY` in the gateway    |
|                | `HELPLINE_NUMBER`         | Fills `[Helpline Number]` in templates         |
|                | `ROBOCALL_WEBHOOK_SECRET` | Token the robocall provider sends; empty closes the webhook |
|                | `PORTAL_1_TECHNICIANSTOCK_URL`, `PORTAL_1_TECHNICIANSTOCK_HASH` | Technician-stock portal: installation test readings and technician stock sync |
|                | `CUSTOMER_APP_LOGIN_DOMAIN`, `CUSTOMER_APP_DEFAULT_PASSWORD`, `PORTAL_READING_FRESH_MINUTES` | Customer app logins and how recent a portal reading must be |
|                | `SHEZZ_API_URL`, `SHEZZ_API_KEY` | Shezz Traders device feed (URL ends in `/api`) |
| `frontend/.env`| `VITE_API_BASE_URL`       | Absolute API origin when the apps are split    |
| `whatsapp-gateway/.env` | `PORT`, `WEBHOOK_API_KEY`, `MESSAGE_DELAY_MS` | Gateway port, shared key, pause between messages |

`.env` files are ignored by git; `.env.example` is committed and holds
placeholders only. Never put a real secret in an example file. A split-origin
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
| Technician  | `technician@trackmaster.com` |

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
| GET    | `/api/operations/reviews`         | admin, operations          |
| POST   | `/api/operations/jobs/:id/review` | admin, operations          |
| PATCH  | `/api/operations/jobs/:id/schedule` | admin, operations        |
| GET    | `/api/operations/microphones`     | admin, operations          |
| POST   | `/api/operations/microphones`     | admin, operations          |
| POST   | `/api/operations/microphones/:id/assign` | admin, operations   |
| POST   | `/api/operations/microphones/:id/release` | admin, operations  |
| GET    | `/api/operations/microphone-tasks`| admin, operations          |
| PATCH  | `/api/operations/technicians/:id/rates` | admin                |
| GET    | `/api/technician/summary`         | technician                 |
| GET    | `/api/technician/jobs`            | technician                 |
| GET    | `/api/technician/jobs/:id`        | technician, own record     |
| POST   | `/api/technician/jobs/:id/stock`  | technician, own record     |
| PATCH  | `/api/technician/jobs/:id/tests`  | technician, own record     |
| POST   | `/api/technician/jobs/:id/portal-check` | technician, own record |
| POST   | `/api/technician/jobs/:id/engine-kill-request` | technician    |
| POST   | `/api/technician/jobs/:id/engine-kill-unsupported` | technician |
| POST   | `/api/operations/jobs/:id/review/refresh` | admin, operations |
| GET    | `/api/customers/check-duplicate`  | session                    |
| PATCH  | `/api/users/:id/target`           | admin                      |
| POST   | `/api/technician/jobs/:id/submit` | technician, own record     |
| GET    | `/api/technician/stock`           | technician                 |
| GET    | `/api/technician/earnings`        | technician                 |
| GET    | `/api/technician-payments`        | admin                      |
| GET    | `/api/technician-payments/:id`    | admin                      |
| POST   | `/api/technician-payments/:id/payments` | admin                |
| POST   | `/api/technician-payments/earnings/:id/reverse` | admin        |
| GET    | `/api/customers/hot-leads`        | admin, manager, salesperson|
| POST   | `/api/customers/:id/hot-lead`     | admin, manager, salesperson|
| DELETE | `/api/customers/:id/hot-lead`     | admin, manager, salesperson|
| GET    | `/api/sales/agents`               | admin                      |
| POST   | `/api/sales/agents/:id/commission`| admin                      |
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
| GET    | `/api/sales/mine`                 | salesperson — own installation counts, cancelled sales and renewals (no money) |
| GET    | `/api/sales/overview`             | admin, manager — company sales and value, by salesperson |
| POST   | `/api/sales/:id/cancel`           | salesperson (own), admin, manager — cancel a sale with a reason |
| POST   | `/api/sales/:id/restore`          | salesperson (own), admin, manager — restore a cancelled sale |
| GET    | `/api/quotations`                 | admin, manager, salesperson (own customers) — search and status filter |
| POST   | `/api/quotations`                 | admin, manager, salesperson (own customer) — a draft, priced from a package |
| GET    | `/api/quotations/:id`             | the same three roles, scoped in the service |
| PATCH  | `/api/quotations/:id`             | drafts only — a sent quote is immutable |
| POST   | `/api/quotations/:id/send`        | draft → sent, fixes the figures and the validity date |
| POST   | `/api/quotations/:id/decision`    | sent → accepted or rejected, with an optional note |
| POST   | `/api/quotations/:id/revise`      | a refused or expired quote becomes a new draft version |
| GET    | `/api/operations/customers?search=` | admin, operations — search-first, max 25 |
| GET    | `/api/operations/customers/:id`   | admin, operations — profile without money records |
| GET    | `/api/operations/message-templates` | admin, operations        |
| POST   | `/api/operations/message-templates` | admin, operations        |
| POST   | `/api/operations/whatsapp/preview` | admin, operations         |
| POST   | `/api/operations/whatsapp/send`   | admin, operations — adds a timeline event |
| GET    | `/api/operations/shezz/preview`   | admin, operations — what a fetch would do |
| POST   | `/api/operations/shezz/sync`      | admin, operations          |
| GET    | `/api/customers/:id/history`      | session — timeline and legacy history |
| *      | `/api/vehicles`, `/api/calls`, `/api/certificates`, `/api/imports`, `/api/messages` | see each module's routes |
| POST   | `/api/webhooks/robocall?token=`   | robocall provider          |

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
| `/admin/quotations`    | Quotation register                            |
| `/admin/operations`    | Operations queue and stock                    |
| `/admin/complaints`    | Complaints                                    |
| `/admin/reports`       | Reports placeholder                           |
| `/admin/pricing`       | Package rates set by the admin                |
| `/admin/approvals`     | Prices quoted below the package rate          |
| `/admin/money`         | Invoices and payments (read and act)          |
| `/admin/technician-payments` | Technician rates, earnings and payments  |
| `/admin/users`         | Account creation and role review              |
| `/admin/activity`      | Activity log                                  |
| `/admin/settings`      | Workspace settings                            |
| `/operations`          | Operations overview                           |
| `/operations/queue`    | Work queue                                    |
| `/operations/complaints` | Complaints desk                             |
| `/operations/inventory`| Device and SIM stock                          |
| `/operations/technicians` | Technicians and their held stock            |
| `/operations/reviews`  | Installation testing review and approval      |
| `/operations/microphones` | Microphone numbers and pending assignments |
| `/operations/reports`  | Operations reports                            |
| `/operations/settings` | Operations settings                           |
| `/salesperson`         | Salesperson “My day”                          |
| `/salesperson/customers` | Own customers                               |
| `/salesperson/customers/:id` | Customer record                        |
| `/salesperson/follow-ups` | Follow-up plan                             |
| `/salesperson/requests` | Installation requests                        |
| `/salesperson/complaints` | Logged complaints                          |
| `/salesperson/quotations` | Quotations for own customers               |
| `/salesperson/sales`   | Sales and renewals                            |
| `/salesperson/hot-leads` | Hot leads                                   |
| `/salesperson/settings`| Account and security                          |
| `/manager`             | Manager overview and billing queue            |
| `/manager/customers`   | Global customer lookup                        |
| `/manager/customers/:id` | Customer account, briefing and money        |
| `/manager/invoices`    | Invoice register, issue and settle            |
| `/manager/payments`    | Payment ledger                                |
| `/manager/complaints`  | Complaint queue (read-only)                   |
| `/manager/reports`     | Invoiced versus received, money position      |
| `/manager/settings`    | Account and data-protection notes             |
| `/technician`          | Technician today                              |
| `/technician/installations` | Assigned installations                   |
| `/technician/installations/:id` | Device, SIM and the four tests        |
| `/technician/stock`    | The technician's own devices and SIMs         |
| `/technician/earnings` | Rates, earnings and payments                  |
| `/technician/settings` | Account and access notes                     |
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
  bottom tab bar with no sidebar for the salesperson, drawers usable on both.
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
- Package floors, checked against MongoDB: saving a minimum above the rate is
  refused; a Basic quote of 12,000 against a 13,000 floor is refused with the
  floor named; 14,000 goes to approval (`pending`) because it is under the 15,500
  rate; 15,500 needs no approval (`not_required`). The Basic package is left at a
  15,500 rate with a 13,000 floor, which is the example the business asked for.
- Quotations, exercised against MongoDB (API and browser): a zero price, a past
  validity date and an unknown package were refused; a draft was edited, then
  sending it fixed the figures and a later edit was refused; accepting a draft was
  refused; the answer was recorded with a note; a rejected quote was revised into
  version 2 with version 1 kept in `history`; an unknown id returned `404`; a
  salesperson quoting another salesperson's customer received `403` and saw none
  of that customer's quotations. Created through the drawer in the browser at
  1440 px and 390 px: no page-level horizontal overflow and no console errors, and
  the printed sheet carried the package rate, the agreed reduction, the validity
  date and the terms. The throwaway quotation, the temporary preview account and
  its sessions/activity were deleted afterwards; two quotations remain on the
  existing `Verification Customer 21276` test record so the states can be
  demonstrated.
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
- **Technician workflow, end to end against MongoDB** (39 checks, all passed):
  an admin is refused by `/api/technician/summary` with `403`; the admin creates a
  technician login and its technician record together; the technician signs in;
  the admin sets the installation rate; a device and SIM are issued and appear in
  that technician's stock only; a sale is created with an agent commission and
  assigned to the technician; an IMEI one digit off is rejected with the closest
  stock number named; the correct pair is accepted; the three tests are recorded;
  submission is blocked until the engine kill is requested; the submission reaches
  the testing review queue; approval closes the installation and creates a
  PKR 2,000 earning; a microphone task appears for the Standard package; the
  number is assigned and a second assignment is refused with `409`; a payment of
  500 leaves 1,500 (which the technician sees); overpayment is refused; the
  customer is marked as a hot lead. The records created by this run are still in
  the database so the screens can be demonstrated.
- Production build after the work: `cd frontend && npm run build` compiled 204
  modules with no errors.

Automated tests: `cd backend && npm test` runs the Node test runner. Pure rules
(invoice maths, template rendering, name matching) run anywhere; database tests
need `TEST_MONGO_URI` pointing at a throwaway MongoDB. 84 tests currently pass,
covering imports, installation rules, billing adjustments, certificates, calls,
messaging, the operations desk, the Shezz fetch and the sales board. A GitHub
Actions workflow (`.github/workflows/ci.yml`) runs the checks on every push.

Not verified against live services: WhatsApp delivery through a real linked
phone, the Shezz feed against production data, and the robocall webhook with the
provider's real payload.

---

## Remaining work

- Deploy the backend where the robocall provider can reach it, and capture one
  real payload to confirm the field mapping.
- Choose and approve the WhatsApp provider for production; the gateway is fine
  for a pilot but is a linked personal number.
- Decide customer email consent before bulk emails are enabled; SMTP is ready.
- Serve the tracking server over HTTPS.
- Set `CERTIFICATE_NUMBER_START` and, if wanted, add the director's stamp image
  for certificates.
- A renewal workflow that records the renewal payment against the vehicle from
  the Sales screen. (AMC payments can be recorded from the customer record; the
  Sales screen still only lists the renewals that are due.)
- Quotation documents are printed from the browser; a server-side PDF, and a
  quotation that turns into a sale with one click, are not built.
- Activity logging for stock movements and complaint updates.
- Salesperson Android wrapper once the web workspace is signed off.

## Known gaps

- Mongo connects to the database named in `MONGO_URI`; keep the database name in
  the connection string so data does not land in the driver default (`test`).
- `JWT_SECRET` must be a fresh random value of 32+ characters on every
  deployment. A value that was ever committed to the repository must be replaced.
- Activity logging is not yet written by every module. Customer creation, package
  pricing, approvals, invoices, payments and briefings are logged; job status
  changes, stock movements and complaint updates are not.
- A cancelled invoice deliberately keeps its reference, and an invoice with money
  against it cannot be cancelled; corrections go through credit notes and refunds.
- The Shezz feed returns at most 2,000 handovers per fetch; the screen says so
  when more remain.
- Vehicle status comes from the tracking sync. If the tracking server cannot be
  reached the UI shows the last known state rather than inventing one.

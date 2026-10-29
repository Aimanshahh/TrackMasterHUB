# TrackMaster Hub — CRM & Operations Platform

**Project folder:** `trackmaster-hub`  

**Product name:** TrackMaster Hub  

**Purpose:** A clean, centralized business system for customer management, sales, renewals, redo/service requests, billing, complaints and operations.

---

## 1. Project Overview

Build a new platform from scratch with four role-based interfaces sharing one backend and database:

1. **Admin** — business-wide control and visibility.

2. **Salesperson** — mobile-first customer portfolio, sales, renewals, redo requests and follow-ups; later packaged as an Android APK.

3. **Manager** — customer lookup, invoice finalization, certificates and permitted account oversight.

4. **Operations** — order queue, assignments, scheduling, service/installation progression and complaints.

This is a **new CRM + operations system**. There is no existing CRM/admin system to extend and no existing CRM database to migrate.

The only existing integration is the **live tracking API(s)**. Inspect and integrate those APIs where needed; do not assume their endpoints, fields, authentication or coverage before discovery.

### Product principles

- Keep the screens clean and task-focused.

- Avoid unnecessary modules and duplicated data.

- Enforce permissions on the backend, not only in the UI.

- Keep customer, sales, operations, billing and subscription/tracking statuses separate.

- Make routine salesperson work practical on a phone.

- Defer general-purpose push notifications for the initial release.

- Include BOTH email and WhatsApp integrations specifically for the OS Ticket System. Confirm providers and exact message rules before implementation.

---

## 2. Recommended Technology

| Component | Technology |

|---|---|

| Web UI | React |

| Backend API | Node.js + Express |

| Database | MongoDB |

| Salesperson Android app | React + Capacitor, after mobile web is stable |

| Live tracking data | Existing authorized TrackMaster/GPS tracking API(s) |

| Authentication | Secure server-side authentication/session strategy |

| Documents | Server-generated PDF quotations, invoices and certificates |

| Styling | A consistent, lightweight component system; keep layouts clean and responsive |

Use one shared API and database for all four interfaces. The interfaces should be role-aware views of the same system, not separate applications with duplicate records.

---

## 3. Roles and Screens

### A. Admin Dashboard — Full Business Access

Admin can view and manage all customers and business records.

**Dashboard**

- Sales and revenue overview.

- Sales pipeline and pending approvals.

- Renewals coming due and overdue.

- High-priority customers and unresolved complaints.

- Operational queue, delays and performance summaries.

**Management**

- View, create, edit and archive customer records under controlled rules.

- View all customers, regardless of salesperson ownership.

- Create/manage users, roles and access.

- Assign and reassign customer ownership with reason and audit history.

- Configure packages, standard rates, negotiated pricing and applicable minimums.

- Approve/reject below-minimum-price sales.

- View sales, renewals, redo/service requests, quotations, invoices, payments, certificates and complaints.

- Configure customer categories, priority labels and business settings.

- View reports and audit logs.

Admin access is business-wide but should still be authenticated, logged and governed by appropriate safeguards.

### B. Salesperson Interface — Mobile-First, Later Android APK

A salesperson should have access to **their own customers and permitted related records only**.

**Customer portfolio**

- Create a new customer independently.

- View and update own customer profiles.

- Search/filter own customers.

- Add notes, follow-up dates and interaction history.

- Set follow-up outcomes and next actions.

- See customer category and priority.

- View relevant sales, renewals, redo/service requests, complaints and account history.

**Sales**

- Create quotations and submit sales.

- Select applicable package and pricing option.

- Submit negotiated rates subject to pricing rules.

- Track approval decisions and sales progress.

- View own sales and performance.

**Renewals**

- Start a renewal for an existing eligible customer/account.

- View known subscription expiry/status from CRM records or authorized tracking API data, with source/freshness shown.

- Prepare renewal quotation, record customer response and follow-up.

- Submit renewal for processing.

- Track renewal outcome and relevant payment/invoice progress.

**Redo / repeat / service work**

- Provide a clear action to start a **Redo / Repeat Work** request for an existing customer.

- Capture the reason and request type, for example: rework, repeat service, correction, revisit or other company-approved types.

- Link the request to the relevant prior sale/job/customer when available.

- Track the request through Operations.

- Keep redo/rework distinct from a normal new sale and a subscription renewal. Confirm the company's exact meaning and allowed request types before implementation.

**Complaints / OS Ticket System**

- Create an OS ticket for a complaint or service issue and view permitted status/history.

- Keep ticket communication with the customer in scope through BOTH email and WhatsApp.

- Do not include general push notifications for all CRM events in the initial release.

**Customer ownership rules**

- Backend automatically assigns a newly created customer's owner to the authenticated salesperson.

- Salespeople cannot select another salesperson as owner, view another salesperson's private portfolio or transfer ownership.

- Duplicate customer checks should warn or prevent duplicate creation using defined matching rules.

- Admin can view all customers and reassign ownership with a recorded reason and audit history.

- Customer records remain in the system if a salesperson leaves; Admin can reassign them.

### C. Manager Dashboard — Customer Lookup and Billing Authority

- Search customers by name, phone, account/customer ID and vehicle registration where supported.

- View permitted customer profile and account history.

- Access authorized live tracking information through the CRM backend, where the API supports it.

- View subscription status, expiry, GPS connectivity and last update only when those fields are reliably available.

- Review new sales, renewals and redo/service requests as required by the agreed workflow.

- Finalize and issue invoices.

- Record/view payments and outstanding balances according to permission policy.

- Generate/issue authorized certificates.

- Review complaints and customer follow-up needs.

Manager is the **invoice finalization authority**. Define permissions for refunds, invoice cancellation, credit notes and edits before release.

### D. Operations Dashboard — Separate Operational Workspace

- Receive submitted sales, renewals and redo/service requests in an operational queue.

- See required customer/request details and approval/payment flags.

- Review completeness and request missing information.

- Assign work to the responsible staff/team.

- Set priority and schedule/reschedule appointments.

- Record progress, visit notes, outcome and relevant evidence.

- Track installation, service, revisit, rework or activation tasks where applicable.

- Manage complaints and resolution details.

- View workload, delays, job history and operational reports.

**Operations inventory and technician assignment (planned):** Operations staff will maintain device stock with IMEI identifiers and SIM stock, including stock-in/stock-out records and availability. They will add and manage technician accounts/profiles, then assign available devices and SIMs station-wise to technicians. Each assignment should record the station, technician, device IMEI, SIM identifier, assignment time, and return/transfer status so inventory remains auditable. Validate uniqueness and prevent assigning an item that is already assigned or unavailable. Define the actual fields, station list, stock reconciliation rules, and whether a device/SIM can be assigned together before implementing these workflows.

Operations should see only the customer and business information required for its work, plus the inventory and technician information needed to execute assignments.

Customer onboarding and installation assignment workflow:
1. The salesperson creates the customer record and selects the intake/request type: Follow-up or New Installation. The backend assigns the salesperson as owner.
2. Follow-up customer minimum information: customer name and phone number; business name is optional. Vehicle/installation fields are not required for a follow-up-only record.
3. New installation customer minimum information: customer name, customer's own phone number, vehicle installation location, car name/label and car number/registration. Capture business name when applicable.
4. On creation, the customer/request is sent directly to the Operations queue. Operations reviews it, assigns a technician, and records the SIM and device IMEI allocated for each vehicle. Allocation must use available inventory and remain auditable.
5. Operations records installation scheduling, progress and completion. Once installation is marked completed, route the customer profile and vehicle/installation details to the Manager for security briefing and profile completion.
6. The Manager records the security briefing details and completes the customer profile. The customer account remains Inactive until the required security briefing is completed. Installation completion alone must not activate the account.
7. Keep customer profile data separate from vehicle records. One customer can have multiple vehicles; each vehicle has its own car name/label, car number/registration, assigned device IMEI, SIM identifier, installation location/station and installation history. Support additional vehicles without duplicating customer personal information.
8. Track customer onboarding, operations/installation, security briefing and account activation as distinct statuses.

**Salesperson status notifications (required):**
- The salesperson who created/pushed a request is the owner of that request. When its operational status changes, that salesperson must be notified in the CRM.
- Installation/job status changes (assigned, scheduled, in progress, completed, cancelled) notify the salesperson who submitted the job.
- Complaint/OS ticket status changes (assigned, in progress, waiting for customer, resolved, closed) notify the salesperson who logged the ticket.
- Notifications are created server-side from the authenticated actor's action, never from the browser. They store the recipient, event type, related record reference, new status, and read state.
- A salesperson sees only notifications addressed to their own account. Notifications carry no sensitive fields (CNIC, DOB, E-PIN, secondary user, credentials).
- Delivery is in-app for the first release; email/WhatsApp remains scoped to the OS Ticket customer messages described in section 8.
---

## 4. Customer Records, Categories and Priority

Keep **customer category** and **customer priority** as two separate fields.

### Suggested customer categories

Start with a configurable list such as:

- Individual

- Business

- Corporate

- Fleet

- Other

These are suggested labels, not a final fixed taxonomy. Admin should be able to maintain categories without code changes if practical.

### Suggested priority levels

- **High Priority**

- **Medium Priority**

- **Normal**

- **Low Priority**

Admin can view and manage priority for all customers. Define whether salespeople can set priority for their own customers or only suggest a change. Keep an optional reason and update history for priority changes.

Priority should be useful, not decorative. Support filtering and sorting by priority, renewal due date, last contact and follow-up date.

### Customer profile should contain

Only fields the business actually needs, for example:

- Customer/account ID generated by the system.

- Customer/person or business name.

- Primary contact and phone.

- Email/address where required.

- Category and priority.

- Owner salesperson.

- Notes and follow-up details.

- Created/updated timestamps.

- Linked sales, quotations, renewals, redo/service requests, complaints, invoices and payment history, according to role permission.

Avoid collecting unnecessary personal data. Define duplicate matching rules, such as normalized phone plus relevant account/name checks, without assuming one field is always unique.

### Customer intake, vehicle records and security briefing
- Customer/person or business profile: Store shared personal/business information once, including customer name, customer's own primary phone number, optional business name, applicable category, priority and salesperson ownership.
- Follow-up intake: Required at creation: customer name and phone number. Business name is optional. Vehicle and installation fields are not required.
- New installation intake: Required at creation: customer name, customer's own phone number, vehicle installation location, car name/label and car number/registration. Business name is optional where applicable.
- Vehicle records (one-to-many): Each customer may have multiple vehicles. Each vehicle has its own car name/label, car number/registration, installation location/station, device IMEI, SIM identifier, technician assignment and installation/job history. Operations links the allocated IMEI and SIM to each vehicle; never treat one customer-level IMEI/SIM as covering every vehicle.
- Manager security briefing fields: CNIC, date of birth (DOB), E-PIN, secondary user phone number, relationship of the secondary user to the customer, geofence address and vehicle station/location. Associate station/geofence details with the relevant vehicle where applicable.
- Sensitive information: CNIC, DOB, E-PIN and secondary-user details are sensitive. Restrict access by role, mask values in lists, protect data in storage/transit, and avoid exposing these fields in salesperson views, general exports, notifications or ordinary activity logs. Confirm authorized viewers/editors and retention requirements before implementation.
- Completion gate: A new installation customer is Inactive / Security Briefing Pending until the Manager completes required briefing fields and marks the briefing complete. Record who completed it and when; then allow activation through a controlled status transition. Follow-up-only records do not enter this gate unless converted to an installation/activation workflow.
---

## 5. Sales, Pricing and Approval Workflow

### Basic flow

1. Salesperson creates or selects an eligible customer.

2. Salesperson prepares a sale and selects its type, package and price.

3. Backend validates required fields, ownership and pricing policy.

4. If price is below the applicable minimum, the sale becomes **Pending Admin Approval**.

5. Operations can see the submitted work with a clear approval flag and may prepare permitted steps.

6. Restricted work completion/finalization steps remain blocked until the required approval.

7. Operations processes the operational work and records its outcome.

8. Manager finalizes/issues the invoice when workflow requirements are met.

9. Payments and operational completion are recorded independently.

Define exactly which steps Operations may perform before approval and what constitutes authorization to proceed.

### Sale/request types

Support clear distinctions such as:

- New sale

- Renewal

- Redo/rework/repeat service

Finalize the redo taxonomy with business stakeholders before building it.

### Pricing rules

- Support the three existing package tiers: Basic, Standard and Premium.

- Support standard rates and authorized negotiated corporate rates.

- Define the effective price/minimum rules for each package, customer category and offer.

- Save the pricing policy/version used when the sale is submitted.

- Below-minimum price requires Admin approval with approver, reason and timestamp.

- Rejected submissions remain in history; changes follow a controlled resubmission process.

- Prevent unauthorized price changes or approval bypasses.

Do not hard-code prices throughout the interface. Manage pricing centrally.

---

## 6. Keep Workflow Statuses Separate

Do not use one status field for every process.

Suggested independent status groups:

- **Sales/Approval:** Draft, Submitted, Pending Approval, Approved, Rejected, Cancelled.

- **Operations:** New, Needs Information, Unassigned, Assigned, Scheduled, In Progress, Completed, Failed, Cancelled.

- **Renewal:** Due, Contacting, Quoted, Awaiting Customer, Submitted, Renewed, Not Renewed, Deferred.

- **Redo/service request:** Submitted, Needs Review, Approved, Assigned, Scheduled, In Progress, Completed, Rejected, Cancelled.

- **Invoice:** Not Issued, Issued, Cancelled/Void, Credit Note Issued where applicable.

- **Payment:** Unpaid, Partially Paid, Paid, Overdue, Refunded where applicable.

- **Subscription:** Active, Expired, Suspended, Cancelled, Unknown — only when reliably sourced.

- **GPS connectivity:** Online, Offline, Unknown — only when reliably sourced.

- **Complaint:** Open, Assigned, In Progress, Waiting for Customer, Resolved, Closed.

These are proposed starting values. Define valid transitions and role permissions for each status.

**Important:** Subscription status, GPS connectivity, sale status, invoice/payment status and operations status are different things. One must not be inferred from another.

---

## 7. Live Tracking API Integration

The existing live tracking API(s) are the **only existing system integration identified so far**. The CRM itself, customer records, sales, billing and workflows are new.

### Discovery before implementation

Inspect and document:

- API base URL(s), endpoint documentation and response examples.

- Authentication and permitted service access.

- Available customer, vehicle, subscription and status fields.

- Supported search keys and reliable identifiers.

- Whether customer-to-vehicle/account association is available.

- Which source owns subscription expiry/status.

- Which source owns GPS connectivity and last communication.

- API permissions, rate limits, TLS and network restrictions.

- API failure behavior and expected data freshness.

Do not assume that every desired field exists in the tracking API.

### Proposed request flow

1. Authorized staff search in the CRM.

2. CRM backend verifies the user's role and access.

3. Backend queries its own customer/account records.

4. Where needed and supported, backend calls the authorized tracking API.

5. Backend normalizes the response and displays its source and last-updated time.

6. If the integration is unavailable, show a clear unavailable/stale state rather than inventing a status.

### Integration safeguards

- Keep API credentials on the server; never expose them in React or the APK.

- Use HTTPS and least-privilege credentials.

- Add timeouts, validation, error handling, sensible caching and rate limits.

- Do not copy GPS history into CRM unless a clear requirement justifies it.

- Device IMEI and SIM inventory are in the Operations scope described above; keep this separate from the external tracking API integration and do not expose integration credentials.

- Validate integration behavior against known examples before release.

---

## 8. Complaints and Ticketing

Salesperson and Operations can log complaints. Define whether Manager and Admin can also create or edit them.

Each complaint should include:

- Unique ticket ID.

- Customer/account and relevant request/sale reference where applicable.

- Category, priority and description.

- Creator and assigned staff/team.

- Created/updated timestamps.

- Status history and internal notes.

- Resolution notes and closure details.

- Optional attachments with access controls.

- Optional SLA target if the business defines one.

### Initial release scope

- Ticket creation, assignment, filtering, status progression and full status history.

- In-app screens show current ticket status and internal staff notes separately from customer-visible messages.

- **Both email and WhatsApp integrations are required for OS Ticket System updates.** This is a scoped exception to the decision to defer general notifications.

- General-purpose push notifications and alerts for unrelated CRM events are deferred.

### Customer communication requirements

- Define which ticket events send a customer message, such as ticket created, assigned (if useful), status changed, waiting for customer, resolved and reopened.

- Send only customer-safe information; never expose internal notes, staff-only details or sensitive account information.

- Use approved message templates and a configured provider. The provider is not selected yet.

- Store communication channel, event, recipient, template/version, timestamp, provider message ID, delivery status and failure reason.

- Retry temporary failures safely, avoid duplicate sends, and show failed/pending delivery in the ticket history for staff follow-up.

- Ticket status changes must still save even if WhatsApp/email delivery fails.

- For configured customer-facing ticket events, attempt delivery through both WhatsApp and email when valid contact details and consent are present.

- Track each channel separately: pending, sent/accepted, delivered where provider supports it, failed, retrying or manually followed up. Do not report a message as delivered merely because an API accepted it.

- Retry transient failures safely, prevent duplicate sends where practical, and show persistent failures to authorized staff.

- Confirm customer contact details, consent/opt-out handling, applicable WhatsApp template approval, email sender/domain setup and provider costs before launch.

- Integrate both channels. Send ticket updates through both WhatsApp and email when the customer has valid contact details and the relevant consent; log channel-specific delivery status and allow staff to record manual follow-up when a channel is unavailable.

- Keep provider credentials on the backend in environment/secret configuration; never expose them to React or the Android APK.

### Open decision

Choose a WhatsApp Business Platform provider and an email delivery service after confirming account ownership, Pakistan availability, WhatsApp template requirements, pricing and whether the business already has an approved WhatsApp Business Platform account. Do not assume ordinary WhatsApp Business app access automatically provides an API.

---

## 9. Quotations, Invoices, Payments and Certificates

### Quotations

- Draft, Sent, Accepted, Rejected and Expired states.

- Customer, request/sale type, package/line items, price, validity and terms.

- Version history and approval requirements.

### Invoices and payments

- Manager finalizes/issues invoices.

- Controlled invoice numbering.

- Amount, paid amount, balance, due date and payment method/reference.

- Partial payment and overdue tracking if required.

- Controlled cancellation, refunds and credit notes.

- Preserve finalized document history; never silently edit issued financial records.

- Confirm tax, accounting and invoicing requirements before production.

### Certificates

- Approved templates and fields.

- Unique reference number and issue date.

- Link to the appropriate customer/account and relevant service/sale.

- Reissue/cancellation history and permission controls.

---

## 10. Renewals, Follow-Ups and Redo Work

Renewals should be a first-class salesperson workflow, not just a report.

- Show upcoming renewals and overdue follow-ups for the salesperson's own portfolio.

- Support renewal lists with filters for due date, priority, category and outcome.

- Record contact attempts, notes, customer response and next follow-up date.

- Prepare and submit a renewal quotation/request.

- Track processing, invoice/payment and renewal outcome.

- Allow Admin and permitted Manager users to view cross-business renewal performance.

- Display tracking subscription/expiry data only if supported and verified by the live API or approved CRM data.

### Redo/repeat work

- Make it easy to create a redo/rework/revisit request from an existing customer record.

- Require request type, reason, relevant history and requested action.

- Link to the earlier sale/job when available.

- Route to Operations for review and processing.

- Track approval, assignment, scheduling, result and closure.

- Do not classify every redo as a new sale or renewal.

- Finalize exact business definitions and any pricing rules for redo cases.

---

## 11. Additional Recommended Features (Keep the First Release Lean)

These are useful additions to consider, but should not become a reason to delay the core workflows. Confirm which are needed before implementation.

### Recommended for the first release

- **Global customer search with permission filtering:** search by name, phone, account ID and supported registration fields without exposing another salesperson’s private portfolio.

- **Customer activity timeline:** one chronological view of calls/contacts, notes, follow-ups, sales, renewals, redo requests, tickets, invoices and payment events, with role-based visibility.

- **Tasks and follow-up reminders inside the CRM:** due today, overdue and upcoming; no push notifications required.

- **Ticket service targets:** configurable priority, due date/SLA, overdue flag and escalation queue if the business can define realistic response/resolution targets.

- **Duplicate handling:** warn on likely duplicate customers and provide a controlled Admin merge/correction process with audit history.

- **Configurable reference data:** customer categories, priority values, ticket categories, ticket statuses where appropriate, request types and cancellation reasons managed by authorized Admin users.

- **Document and attachment controls:** access-restricted uploads, file-size/type limits and links to the relevant customer, sale or ticket.

- **Export and print:** role-controlled CSV/PDF export for permitted reports and downloadable quotations/invoices/certificates; log sensitive bulk exports.

- **Audit history and soft archive:** avoid permanently deleting customers, tickets and issued financial records through ordinary UI actions.

- **Backup and recovery:** scheduled database backups and a tested restore procedure.

### Useful later, not required to launch

- General push notifications for internal CRM events.

- Advanced sales targets/commission calculations, if the business defines the rules.

- Customer self-service portal.

- Accounting software integration.

- Automated bulk marketing campaigns.

- Advanced analytics beyond the initial operational and sales reports.

Avoid adding these by default: barcode stock workflows, a duplicate CRM, or copying the tracking platform's entire functionality into TrackMaster Hub. Device IMEI and SIM stock are explicitly included in the Operations plan above.

---

## 12. Reports and Workspace Experience

### Admin

- Sales count/value by period and salesperson.

- Pipeline, conversion and follow-up coverage.

- Discount/approval summaries.

- Invoiced revenue versus collected payments.

- Renewal due/overdue and renewal outcomes.

- Redo/service request volume and completion.

- Complaint volumes and resolution metrics.

- Operational backlog, delays and turnaround.

### Salesperson

- Own customers and customer priorities.

- Today's/overdue follow-ups.

- Renewals due and renewal pipeline.

- Own sales, approval decisions and request progress.

- Own complaint list and activity history.

### Manager

- Customer lookup and permitted account summaries.

- Invoice queue and billing summaries.

- Renewals and relevant service/customer history.

### Operations

- Work queue and assignments.

- Priority, schedule, aging and delays.

- Completed/failed work and complaint metrics.

### UI guidelines

- Use a clean, modern, consistent design system.

- Prioritize search, clear tables/lists, filters and readable detail pages.

- Avoid overcrowded dashboards, excessive cards and unnecessary animations.

- Make common salesperson actions accessible with minimal taps.

- Provide useful empty, loading, error and permission states.

---

## 13. Security, Audit and Data Governance

- Enforce role permissions and customer ownership in every relevant backend route.

- Never rely on frontend hiding as security.

- Validate request data and use safe database query patterns.

- Use secure password hashing, session/token handling and account recovery.

- Apply rate limits and login protection.

- Log important changes: ownership, priority, pricing, approvals, invoice issue/cancellation, payments and status transitions.

- Restrict exports and bulk access.

- Define data retention, privacy and attachment policies.

- Keep secrets outside source control.

- Use separate development, staging and production configuration.

- Back up the new CRM database and test restoration.

- Use controlled migrations and seed only non-sensitive sample data.

---

## 14. Recommended Development Phases

### Phase 1 — Requirements and API Discovery

- Confirm exact customer categories and priority rules.

- Define what the company means by renewal, redo, repeat service and rework.

- Review live tracking API documentation, authentication and available data.

- Finalize role/permission matrix and workflow status transitions.

- Define required customer and financial fields.

**Deliverable:** Approved requirements, API assessment and workflow diagrams.

### Phase 2 — Foundation

- Create the new MERN application structure.

- Set up environments, database, authentication and role permissions.

- Define customer, user, activity and audit models.

- Implement ownership and duplicate checks.

- Establish API conventions, validation and error handling.

**Deliverable:** Secure foundation with tested customer access rules.

### Phase 3 — Admin and Salesperson

- Admin dashboard, user management, customer oversight and categories.

- Priority and customer ownership management.

- Salesperson customer portfolio, follow-ups and notes.

- Quotations, sale submissions and pricing approval.

- Responsive salesperson experience.

**Deliverable:** Customer and sales pipeline usable end to end.

### Phase 4 — Operations and OS Ticket System

- Operations queue for new sales, renewals and redo/service work.

- Review, assignment, scheduling and progression.

- Operational notes, evidence and completion outcomes.

- Complaint/OS ticket intake, status workflow and customer communication integration.

- Configure and test BOTH the selected email service and WhatsApp Business Platform provider for agreed ticket events.

**Deliverable:** Operational processing from submission to completion, with working ticket updates to customers.

### Phase 5 — Manager and Billing

- Customer lookup.

- Live tracking API integration for verified fields.

- Invoice and certificate generation/finalization.

- Payments and financial controls.

- Renewal review and account oversight.

**Deliverable:** Controlled billing and authorized customer/tracking view.

### Phase 6 — Renewals, Reporting and Polish

- Renewal pipeline and follow-up workflows.

- Redo/rework handling refinements.

- Role dashboards, filters, exports and reports.

- Usability, performance and accessibility improvements.

**Deliverable:** Business workflows and reporting ready for acceptance testing.

### Phase 7 — Testing and Release

- Test permissions across all four roles.

- Test ownership isolation and customer duplication cases.

- Test pricing, approval and status transitions.

- Test invoices, payment math and document numbering.

- Test tracking API timeouts, invalid responses and stale data.

- Deploy staging, conduct user acceptance testing, then production.

- Package and test Salesperson Android APK.

**Deliverable:** Production-ready web system and tested Android app.

---

## 15. Salesperson Android APK

Once the responsive Salesperson interface is stable:

1. Add Capacitor to the React app.

2. Configure Android application ID, app name and icon.

3. Point the app to the deployed HTTPS CRM API.

4. Build and install a test APK.

5. Test sign-in, customer ownership, customer creation, follow-ups, sales, renewals, redo requests and complaints.

6. Prepare a signed release APK or AAB according to the distribution method.

Keep one shared Salesperson UI and backend. Confirm offline expectations before adding local data storage. General push notifications are not part of the initial APK scope; OS ticket email/WhatsApp messages are sent by the backend and do not depend on the APK being open.

---

## 16. Acceptance Checklist

### Foundation

- [ ] New repository/application named `trackmaster-hub`.

- [ ] Development/staging/production configuration.

- [ ] Authentication and four roles.

- [ ] Backend-enforced access permissions.

- [ ] Customer ownership and duplicate checks.

- [ ] Audit log and validation.

### Customer and Sales

- [ ] Admin can view all customers.

- [ ] Salesperson can only access own customers and allowed records.

- [ ] Salesperson can create customers independently.

- [ ] Customer categories and priority labels.

- [ ] Follow-ups, notes and interaction history.

- [ ] New sale and quotation.

- [ ] Standard and negotiated pricing.

- [ ] Below-minimum Admin approval.

### Operations and Service

- [ ] Separate Operations workspace.

- [ ] Sales, renewal and redo/service work queues.

- [ ] Assignment, scheduling and status progression.

- [ ] Operations device stock with unique IMEI records and SIM inventory.

- [ ] Operations can add/manage technicians and assign available devices/SIMs station-wise with an auditable handoff/return history.

- [ ] OS Ticket System: ticketing, assignment, history and resolution.

- [ ] Email AND WhatsApp messages for agreed ticket events, where the customer has valid contact details and consent.

- [ ] Communication delivery log, retry/failure visibility and customer-safe templates.

- [ ] Device/SIM assignment and return history is auditable; unavailable or already-assigned stock cannot be allocated again.

### Manager and Tracking

- [ ] Customer lookup.

- [ ] Verified live tracking API integration.

- [ ] Manager invoice finalization.

- [ ] Payments and certificates.

- [ ] Clear stale/unavailable API states.

### Renewals and Release

- [ ] Renewal pipeline and reminders inside the CRM UI (no push required).

- [ ] Redo/rework request workflow.

- [ ] Reports and role-specific summaries.

- [ ] Role and workflow testing.

- [ ] OS ticket message delivery, failure, retry and duplicate-send tests.

- [ ] Staging and production deployment.

- [ ] Salesperson APK testing and packaging.

- [ ] Backup/restore test.

---

## 17. Decisions and Scope

- Four interfaces: Admin, Salesperson, Manager and Operations.

- System is **new and built from scratch**.

- The only identified existing integration is the live tracking API(s).

- Admin can view all customers and business records.

- Salesperson can create customers independently and sees own customer portfolio only.

- New customer ownership is assigned by the backend.

- Admin can reassign customer ownership with an audit trail.

- Operations has a separate interface.

- Manager has invoice finalization authority.

- Pricing supports standard packages and negotiated pricing.

- Below-minimum-price sales require Admin approval.

- Salesperson needs renewal and redo/repeat/service request workflows.

- Customers have categories and a separate priority classification, including High Priority.

- Operations owns device IMEI and SIM inventory, technician records, and station-wise assignment with auditable stock movement.

- General-purpose push notifications are **deferred for now**.

- Both email and WhatsApp customer messaging are **required for the OS Ticket System only**; providers and exact event/template rules remain to be selected.

- Ticket communication delivery logs, safe customer-facing templates, retries and failure visibility are in scope.

- Salesperson UI will be mobile-first and may be packaged as an Android APK.

---

## 18. Recommended First Implementation Task

**Start with requirements finalization and live tracking API discovery.**

Before coding full workflows:

1. Confirm what “redo” means operationally and the available request types.

2. Confirm customer categories, priority levels and who can change them.

3. Confirm renewal business rules and how expiry is sourced.

4. Inspect the live tracking API endpoints, authentication and response fields.

5. Approve the role/permission matrix and workflow statuses.

6. Then design the MongoDB models and API contracts.

Build the smallest complete path first: **Salesperson creates customer → submits sale → Admin approval when needed → Operations processes work → Manager finalizes invoice.** Then extend the same foundations to renewals, redo requests, complaints and reporting.
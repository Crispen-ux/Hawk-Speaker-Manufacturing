# Cretek Ledger — All-Phases Release Plan

This document is the release gate for the full Ledger application. Phase 1 is the accounting foundation; the remaining phases complete the operating system around it.

## Phase 1 — Financial Core

- Chart of Accounts
- Journal-first double-entry posting
- General Ledger
- Trial Balance
- Income Statement
- Balance Sheet
- Accounts Receivable / Accounts Payable
- VAT reporting
- Bank accounts and reconciliation controls
- Payments, receipts and credit notes
- Expenses, supplier bills, payroll and fixed assets posting
- Period controls
- Audit trail and immutable financial history
- CSV/PDF financial exports

**Invariant:** every posted accounting event must balance debits and credits and be traceable to its source transaction.

## Phase 2 — Sales & CRM

- Clients and client 360 view
- Quotations and quotation lifecycle
- Quotation-to-invoice conversion
- Invoices and payment tracking
- Recurring billing
- Customer statements
- Opportunities and activity timeline
- Payment reminders
- Sales document PDFs
- Email and WhatsApp delivery

**Invariant:** customer-facing sales documents and collections must reconcile to AR and the GL.

## Phase 3 — Purchasing & Operations

- Suppliers
- Purchase orders
- Supplier bills
- Delivery notes
- Job cards
- Catalogue / products / services
- Inventory and stock movements
- BOM management
- Operational document PDFs
- Source-document cross-linking

**Invariant:** operational records must have clear ownership, status, source references and financial impact where applicable.

## Phase 4 — Client Portal & Communications

- Secure client portal authentication
- Client invoices, quotations, statements, receipts and delivery notes
- Document centre
- Public document links
- Quotation approval / decline workflow
- Email communications
- WhatsApp communications
- Notifications and push subscriptions

**Invariant:** portal users can access only records belonging to their client identity, and public tokens are unguessable and scoped to one document.

## Phase 5 — People, Payroll & Assets

- Employees
- HR overview
- Contracts
- Leave management
- Payroll runs
- Payslips
- Fixed assets
- Asset acquisition and financial posting
- Financial history protection

**Invariant:** payroll and asset events that affect the books must post through the same controlled accounting engine.

## Phase 6 — Automation & Business OS

- Automation builder
- WHEN / IF / THEN workflows
- Workflow CRUD
- Run history
- Recurring invoice automation
- Notifications triggered by business events
- Extensible communication channels
- Cross-module event architecture

**Invariant:** automation must be idempotent, observable and safe to retry.

## Phase 7 — Enterprise Hardening & Release

- Consistent premium UI and responsive layouts
- Decluttered navigation
- Validation and error states
- Authentication and authorization checks
- Auditability of sensitive actions
- Immutable posted financial records
- Period lock enforcement
- Duplicate-event protection
- Production CI lint/build gate
- Database migration discipline
- Runtime error monitoring
- Vercel deployment verification
- Accounting reconciliation checks

## Release acceptance gate

Before production release, verify:

1. `npm ci` succeeds.
2. `npm run lint` succeeds.
3. `npm run build` succeeds.
4. Accounting reports are journal-driven.
5. Trial Balance debits equal credits.
6. Balance Sheet balances.
7. Invoice, payment and credit-note events are idempotent.
8. Closed accounting periods reject new financial postings.
9. Issued financial documents cannot be silently rewritten.
10. VAT output/input/reconciliation reports agree with posted tax entries.
11. Portal authorization prevents cross-client access.
12. Public approval/share tokens cannot be changed through tampered form fields.
13. Recurring automation is safe to retry.
14. PDFs, email and WhatsApp actions fail visibly rather than silently.
15. Production deployment is READY and runtime errors are reviewed.

The release branch is intentionally kept separate from `main` until the full gate is passed.

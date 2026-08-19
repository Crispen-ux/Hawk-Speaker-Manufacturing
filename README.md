# Ledger — Invoicing, Quotations, Statements & Recurring Billing

A small multi-device invoicing system: clients, invoices, quotations,
recurring billing, a product/service catalogue, emailing documents
directly from the app, and a dashboard. Built with Next.js (App Router),
Drizzle ORM and Postgres, styled as a ledger book.

## 1. Get a Postgres database

Any standard Postgres works. The easiest free option that pairs well with
Vercel is **[Neon](https://neon.tech)**:

1. Create a free Neon project.
2. Copy the **pooled** connection string (the one with `-pooler` in the
   hostname) — it looks like:
   `postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

(Vercel Postgres and Supabase also work — just use their connection string.)

## 2. Get a Resend account (for emailing documents)

Sending invoices/quotations/statements by email uses **[Resend](https://resend.com)**:

1. Sign up for a free account.
2. Add and verify a sending domain (Settings → Domains) — this is required
   before you can send to arbitrary recipients, not just your own inbox.
3. Create an API key (Settings → API Keys).
4. Note your `EMAIL_FROM` address, e.g. `"Your Company <billing@yourdomain.com>"`
   — the domain must match the one you verified.

If you skip this step, everything else still works — you'll just get a
clear error message if you try to send an email until it's configured.

## 3. Run locally (optional but recommended first)

```bash
npm install
cp .env.example .env.local
# edit .env.local: DATABASE_URL, APP_PASSWORD, RESEND_API_KEY, EMAIL_FROM

npm run db:push   # creates all tables in your database
npm run dev        # http://localhost:3000
```

Log in with the `APP_PASSWORD` you chose, then visit **Settings** first to
fill in your company name, logo, address and banking details — these
appear on every PDF and email.

## 4. Deploy to Vercel

1. Push this folder to a GitHub repo (or run `vercel` directly from this
   directory with the [Vercel CLI](https://vercel.com/docs/cli)).
2. In the Vercel dashboard, **Import Project** from that repo.
3. Under **Environment Variables**, add:
   - `DATABASE_URL` — your Neon/Postgres pooled connection string
   - `APP_PASSWORD` — the password you'll use to log in
   - `RESEND_API_KEY` and `EMAIL_FROM` — for sending documents by email
   - `CRON_SECRET` — a random string (e.g. `openssl rand -hex 32`),
     needed for recurring invoices (see below)
4. Deploy.
5. Once deployed, run the schema push once against your **production**
   database (from your local machine, with `.env.local` pointing at the
   production `DATABASE_URL`):
   ```bash
   npm run db:push
   ```
   Run this again any time you pull an update that changes `db/schema.ts`.

That's it — the app is now live and reachable from any device, protected
by the single password you set.

## What's included

- **Clients** — contact details, billing address, notes
- **Invoices** — line items, tax, discount, due dates, payment tracking
  (draft → sent → partial/paid → overdue), PDF download, **send by email**
- **Quotations** — same as invoices, plus one-click **convert to invoice**
  and send by email
- **Recurring invoices** — set up a client, schedule (weekly / monthly /
  quarterly / yearly), line items and due terms once; invoices generate
  automatically on schedule via a daily Vercel Cron job, with an optional
  **auto-send by email** per profile. A "Generate now" button is also
  available for one-off early runs. Great fit for hosting/retainer clients.
- **Catalogue** — save products or services you bill repeatedly (a
  hosting plan, an hourly rate, a package) with a default price, and add
  them into any invoice, quotation, or recurring invoice in one click
  instead of retyping line items.
- **Statements** — per-client account statement over a date range, PDF
  download or send by email
- **Dashboard** — outstanding balance, overdue total, paid this month,
  drafts, recent activity
- **Settings** — company info, logo, banking details, default tax rate,
  invoice/quotation number prefixes

## How recurring billing works

Each recurring profile stores a client, a frequency, due terms, and its
own set of line items (which can be pulled from the catalogue). Every day,
Vercel's cron calls `/api/cron/recurring`, which finds any profile whose
`next run date` has arrived, generates a real invoice from it, advances
the schedule, and — if that profile has auto-send switched on — emails it
to the client immediately. Otherwise it's created as a draft for you to
review and send yourself.

The cron is defined in `vercel.json` and runs once daily at 06:00 UTC
(the Hobby plan allows at most once/day; upgrade to Pro if you need more
frequent runs). It's protected by `CRON_SECRET` — Vercel automatically
sends this as a Bearer token on every cron request, so nobody else can
trigger it.

## Notes & things you may want to change

- **Branding**: this build ships pre-branded for Cretek Group — the sidebar
  and login screen fall back to the bundled logo (`public/cretek-logo-reversed.svg`)
  and the navy/cyan palette until you upload logos in **Settings**. There are
  two separate logo slots: one for light backgrounds (used on PDFs) and one
  for dark backgrounds (used in the sidebar and login screen) — upload your
  full-colour/navy mark to the first and a white/reversed version to the
  second, so neither disappears against its background. The palette itself
  lives in `app/globals.css` as CSS variables if you ever need to adjust it
  further.
- **Auth** is a single shared password (no per-user accounts) stored as an
  HMAC-signed cookie — a good fit for "just me, a few devices." If you
  later want multiple named users, that's a bigger change (real auth
  provider + a `users` table).
- **Currency** defaults to `R` (Rand) in `lib/money.ts` (`formatMoney`) —
  change the default there if you bill in another currency.
- Invoice/quotation numbers auto-increment from **Settings** (prefix +
  next number), so numbering survives edits and deletions correctly.
- PDF rendering uses `@react-pdf/renderer` and runs server-side on Node
  (not the Edge runtime).
- Emails are sent via Resend's HTTP API directly (no SDK dependency), with
  the PDF attached. If `RESEND_API_KEY`/`EMAIL_FROM` aren't set, the
  "Send" buttons show a clear inline error instead of failing silently.

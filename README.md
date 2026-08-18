# Ledger — Invoicing, Quotations & Statements

A small multi-device invoicing system: clients, invoices, quotations, PDF
downloads, payment tracking and a dashboard. Built with Next.js (App
Router), Drizzle ORM and Postgres, styled as a ledger book.

## 1. Get a Postgres database

Any standard Postgres works. The easiest free option that pairs well with
Vercel is **[Neon](https://neon.tech)**:

1. Create a free Neon project.
2. Copy the **pooled** connection string (the one with `-pooler` in the
   hostname) — it looks like:
   `postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

(Vercel Postgres and Supabase also work — just use their connection string.)

## 2. Run locally (optional but recommended first)

```bash
npm install
cp .env.example .env.local
# edit .env.local: paste your DATABASE_URL, choose an APP_PASSWORD

npm run db:push   # creates all tables in your database
npm run dev        # http://localhost:3000
```

Log in with the `APP_PASSWORD` you chose, then visit **Settings** first to
fill in your company name, address and banking details — these appear on
every PDF.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo (or run `vercel` directly from this
   directory with the [Vercel CLI](https://vercel.com/docs/cli)).
2. In the Vercel dashboard, **Import Project** from that repo.
3. Under **Environment Variables**, add:
   - `DATABASE_URL` — your Neon/Postgres pooled connection string
   - `APP_PASSWORD` — the password you'll use to log in
4. Deploy.
5. Once deployed, run the schema push once against your **production**
   database (from your local machine, with `.env.local` pointing at the
   production `DATABASE_URL`):
   ```bash
   npm run db:push
   ```
   You only need to do this once (and again any time you change
   `db/schema.ts`).

That's it — the app is now live and reachable from any device, protected
by the single password you set.

## What's included

- **Clients** — contact details, billing address, notes
- **Invoices** — line items, tax, discount, due dates, payment tracking
  (draft → sent → partial/paid → overdue), PDF download
- **Quotations** — same as invoices, plus one-click **convert to invoice**
- **Statements** — per-client account statement over a date range, PDF
  download
- **Dashboard** — outstanding balance, overdue total, paid this month,
  drafts, recent activity
- **Settings** — company info, default tax rate, invoice/quotation number
  prefixes

## Notes & things you may want to change

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

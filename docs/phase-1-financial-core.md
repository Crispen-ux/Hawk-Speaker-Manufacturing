# Phase 1 — Financial Core

The accounting model is now journal-first:

`Business transaction → accounting event → journal entry → general ledger → reports`

## System posting rules

- Invoice issued: Dr 1100 Trade receivables / Cr 4000 Sales / Cr 2100 VAT.
- Customer payment: Dr 1000 Bank & cash / Cr 1100 Trade receivables.
- Credit note: Dr 4000 Sales reversal / Dr 2100 VAT reversal / Cr 1100 Trade receivables.
- Supplier bill: Dr 1200 Inventory or 5100 Expense / Dr 2100 Input VAT / Cr 2000 Trade payables.
- Supplier payment: Dr 2000 Trade payables / Cr 1000 Bank & cash.
- Approved expense: Dr expense / Cr 1000 Bank & cash.
- Paid payroll: Dr 5000 Salaries / Cr 2200 PAYE & deductions / Cr 2300 UIF / Cr 1000 Bank & cash.
- Asset acquisition: Dr 1300 PPE / Cr 1000 Bank & cash.

System entries are idempotent by business-event reference and cannot be edited or deleted. Corrections must be posted as reversals or credit notes.

## Controls

- Accounting periods can be opened/closed.
- Journal integrity checks validate every entry and the global debit/credit balance.
- Bank transactions can be imported and reconciled.
- AR, AP and VAT balances are derived from the GL.
- Historical sub-ledger records are backfilled once into the journal to avoid double-counting.

South Africa's current standard VAT rate is 15%; the application remains transaction/configuration driven for zero-rated and exempt supplies.

# Ledgr — Accounting System

React + Vite accounting web app, backed by Supabase for auth and cloud data storage.

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Connect Supabase**
   - Copy `.env.example` to `.env`
   - Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase project → Settings → API)

3. **Create the database tables**
   - Open your Supabase project → SQL Editor → New query
   - Paste the contents of `supabase/schema.sql` and run it
   - This creates the `accounts`, `clients`, `vouchers`, `bills` and `settings` tables, each locked down with Row Level Security so a user can only ever see their own rows

4. **Create your login**
   - This app is built for a single user. Open Supabase → Authentication → Users → Add user, set an email + password (auto-confirm it), and use those credentials to sign in
   - There's no public sign-up flow — by design, this is a private, single-account ledger

5. **Run it**
   ```
   npm run dev
   ```

## Deploy
1. Push to GitHub
2. Import in Vercel — it auto-detects Vite
3. Add the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as Environment Variables in the Vercel project settings
4. Done

## Modules
- Dashboard
- Client Management
- Chart of Accounts (master account list + balance chart)
- Voucher / Journal Entry System
- Trial Balance
- Cash Flow Statement
- Financial Condition & Operations (Balance Sheet + Income Statement)
- Billing / Invoicing
- Settings

## Data & Auth
All data lives in Supabase Postgres, scoped per-user via Row Level Security — see
`supabase/schema.sql`. Auth is Supabase email/password, gating the whole app
(see `src/App.jsx` and `src/pages/Login.jsx`).

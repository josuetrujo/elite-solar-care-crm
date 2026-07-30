# Elite Solar Care — CRM

A custom CRM for Elite Solar Care LLC: customers, sales pipeline, scheduling, recurring-cleaning reminders, and invoicing. Built with React + Vite + Tailwind, with an optional Supabase cloud backend, Square payments, and Twilio/Resend reminders — all **off by default** so you can run it today and switch features on later by adding keys.

> **You are a beginner — that's fine.** Follow the numbered steps. You only ever copy/paste. Nothing here can break your computer.

---

## 1. Run it right now (demo mode — no accounts needed)

You need **Node.js** installed (https://nodejs.org, pick the "LTS" button, install, restart your terminal).

Then, in a terminal:

```bash
cd "Elite Solar Care"     # this project folder
npm install               # one-time: downloads the building blocks
npm run dev               # starts the app
```

Open the link it prints (usually **http://localhost:5173**). You'll see the CRM with **sample customers**. Click around: Dashboard, Customers, add/edit a customer, Schedule, the quote calculator. In demo mode your changes save in your browser only.

To stop the app: press **Ctrl + C** in the terminal.

---

## 2. What's already built

- **Customers** — searchable list, filter by pipeline stage, full detail page.
- **Contacts** — ONE list of everybody, labelled Customer / Lead / Do Not Call /
  Not Interested / Bad Number, with chips and counts to filter it.
- **Calling** — Call Mode (one lead at a time, tap-to-call, big outcome buttons). Outcomes
  re-label contacts automatically (Customer / Callbacks / Not Interested / Bad Number / DNC).
- **History per contact** — one sortable table of every call and cleaning: click any column
  to sort like a spreadsheet, whether they answered, what was quoted or charged, and note
  previews that open in full. A booked cleaning shows as **Upcoming** until its date passes,
  then **Past due** until you say what happened.
- **Pipeline** — New Lead → Quoted → Scheduled → Completed → Recurring.
- **System details** — panel count, stories, roof type, property type.
- **Quote calculator** — uses your real price list ($8/panel, $50/story, $0.54/mi, +$100 non-shingle, +$100 first-time).
- **Appointment calendar** — pick a date and **Book it** on a customer's page; the job appears
  on the Schedule screen under Past due / Today / Next 7 days / Later, plus a month grid.
  **Done** completes the job and auto-sets the next recurring cleaning.
- **Invoices & receipts** — branded receipts numbered on from ESC-1003. **PDF** saves one
  through your browser's print box (no extra software), **Email** sends it to the customer —
  through your own email app today, or straight from the CRM once Resend keys are added.
  Completing a booked cleaning raises the invoice for you.
- **Consent tracking** — SMS/email opt-in checkboxes (required by law before messaging).
- **Settings** — shows which connections are on/off and your role.
- **Accounts & crew** — sign in, forgot-password by email, and an approval gate:
  a brand-new account can see *nothing at all* until an admin approves it in
  Settings → Team. Roles: admin / member / viewer.
- **Photos** — before/after shots per customer, shrunk on the phone before upload,
  stored privately and shown through short-lived signed links.
- **Reports** — money collected by month, average job, calls per sale, and where
  the list stands.
- **Clean up list** (admin) — merges contacts entered twice, and parks the ones
  with no dialable number so they stop clogging the call queue.
- **Works with no signal** — the app opens offline and call outcomes are saved on
  the phone, then uploaded automatically when signal returns.
- **Card payments & reminders** — wired up but OFF until you add keys
  (see **PAYMENTS-AND-REMINDERS.md**).

### Guides in this folder

| File | What it's for |
|---|---|
| `START-HERE.md` | Opening the CRM on your Mac, day to day |
| `DEPLOY.md` | Putting the CRM online so it works on your phone |
| `ACCOUNTS-AND-SECURITY.md` | Adding your crew, roles, password resets, keeping the list private |
| `PAYMENTS-AND-REMINDERS.md` | Turning on Square payments and SMS/email reminders |

---

## 3. Turn on the real cloud database + logins (Supabase) — free

This gives you real accounts, permissions, and your full **1,521-contact** list in the cloud.

1. Create a free project at **https://supabase.com** (New project; pick a strong database password; wait ~2 min).
2. In the project: left menu → **SQL Editor** → **New query**. Open the file `supabase/schema.sql` from this project, copy everything, paste, and click **Run**. (This creates the tables and security rules.)
3. Get your keys: left menu → **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
4. In this project, copy `.env.example` to a new file named `.env` and fill in:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
5. Stop the app (Ctrl+C) and run `npm run dev` again. It now uses the cloud. Sign up with your email — that's your login.
6. **Make yourself the admin:** Supabase → SQL Editor → run (use your email):
   ```sql
   update profiles set role = 'admin', approved = true, approved_at = now()
   where email = 'you@example.com';
   ```
   Everyone after you signs up in the app and waits for you to approve them under
   **Settings → Team** — see `ACCOUNTS-AND-SECURITY.md`.

### Import your contact list
1. Get a **service role** key: Supabase → Project Settings → API → `service_role` (secret). Use it only locally.
2. Run (point it at the master list in your vault):
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
   node scripts/import-customers.mjs "/path/to/Solar Customers (Master List).xlsx"
   ```
   It loads everyone as "New Lead". The spreadsheet is **never** committed to GitHub (privacy).

---

## 4. Turn on card payments (Square) — later

Receipts already work with no setup — this step is only about letting customers pay by card.
Full walkthrough with copy-paste commands: **PAYMENTS-AND-REMINDERS.md** (Part 1).

## 5. Turn on reminders (SMS = Twilio, Email = Resend) — later

Full walkthrough with copy-paste commands: **PAYMENTS-AND-REMINDERS.md** (Part 2).
Reminders respect each customer's consent checkbox automatically — on the server, not just
in the browser — and refuse to send the same reminder twice within 7 days.

---

## 6. Put it online (GitHub Pages) — free

```bash
npm run build          # creates the shareable site in /dist
```

The auto-deploy file is already here (`.github/workflows/deploy.yml`). Step-by-step
instructions — including adding the CRM to your phone's home screen — are in **DEPLOY.md**.
Because the app uses `HashRouter` and a relative base path, it works on GitHub Pages, a NAS,
or Hostinger with no extra config.

> **Reminder:** never commit your `.env`. Keys live in Supabase secrets / your host's environment settings.

---

## Project structure
```
src/
  data/        # local demo + Supabase data providers (auto-selected) + read cache
  lib/         # config/feature-flags, supabase, pricing, square, notifications,
               # receipt, phone, images, offline outbox
  context/     # auth (login + roles)
  components/  # layout, nav, status badge
  pages/       # Dashboard, Call Mode, Leads, Callbacks, Customers, CustomerDetail,
               # Schedule, Invoices, Reports, Cleanup, Settings, Login, ResetPassword
public/sw.js                     # service worker — lets the app open with no signal
supabase/schema.sql              # database + permissions (run once in Supabase)
supabase/functions/              # server-side: Square invoices, SMS/email reminders
scripts/import-customers.mjs     # load the master list into Supabase
```

## Tests
```bash
npm test     # checks the offline outbox: nothing logged without signal is ever lost
```

## Need help?
Every setup step is also written in plain language in your Obsidian vault under **04-Projects/CRM/**. Ask your AI assistant to "continue the CRM build" and it will read the vault for full context.

# ▶️ How to Start the Elite Solar Care CRM

A copy-paste guide to opening your CRM. After the one-time setup it's three steps.

---

## What you need (one time only)

**Node.js** — the engine that runs the app.

1. Go to **https://nodejs.org**
2. Click the big **LTS** button.
3. Open the downloaded file and click through (Continue → Agree → Install).
4. **Quit and reopen Terminal** afterwards.

> Not sure if you already have it? Skip ahead — if it's missing, Terminal says
> `command not found: node`, and you install it then.

---

## Starting the app (every time)

### 1. Open Terminal
Press **Cmd + Space**, type **Terminal**, press **Enter**.

### 2. Go to the project folder
Copy-paste this exactly (keep the quotes) and press **Enter**:

```
cd "/Users/josuetrujo/Claude/Projects/Elite Solar Care"
```

Nothing appears to happen. That's correct — it just moved you into the folder.

### 3. Start it

```
npm run dev
```

A few lines appear, including one like:

```
➜  Local:   http://localhost:5173/
```

### 4. Open it in your browser
Hold **Cmd** and click that `http://localhost:5173/` link (or type it into Chrome/Safari).

### 5. Sign in
Your Supabase email and password. Forgotten it? Tap **Forgot your password?** and
follow the emailed link. *(For that to work on localhost, `http://localhost:5173/**`
has to be listed under Supabase → Authentication → URL Configuration → Redirect URLs.
One-time setup — see `ACCOUNTS-AND-SECURITY.md`.)*

You're in. Your real contacts, Call Mode, the Schedule, Invoices and Reports all load
from the cloud database.

---

## Stopping it

Click back on the Terminal window and press **Ctrl + C**. The app stops.

**Your data is safe** — it lives in the cloud, not in the Terminal window. Nothing is
lost by closing anything.

To start again later, repeat steps 1–4.

---

## First run after I send you updates

Usually nothing extra — just `npm run dev` as normal.

Only if Terminal complains about a missing package, run this once, then start again:

```
npm install
```

---

## Want it without the Terminal?

Once you follow **DEPLOY.md**, the CRM lives at a web address and you can add it to
your phone's home screen. Then there's no Terminal, no laptop, no `npm run dev` —
you just tap the icon. It also opens with no signal, and any calls you log offline
upload themselves when you're back in range.

The Terminal method above stays available either way; it's useful for trying changes
before they go live.

---

## If something goes wrong

- **`command not found: node` or `npm`** → Node isn't installed. Do the "What you need"
  step above, then quit and reopen Terminal.
- **`cd: no such file or directory`** → The path is slightly off. In Finder, find the
  `Elite Solar Care` folder, then in Terminal type `cd ` (with a space) and **drag the
  folder into the Terminal window** — it pastes the correct path. Press Enter.
- **"Port 5173 is in use"** → It's already running in another Terminal tab. Use that tab,
  or press Ctrl + C there first.
- **The page says "Loading…" forever** → Usually the database has gone to sleep, or the
  `.env` file is missing its keys. The twice-weekly check should keep the database awake;
  if it's been longer than that, tell me and I'll wake it.
- **"Waiting for approval" after signing in** → That account hasn't been approved yet.
  Sign in as yourself (admin) and approve it under **Settings → Team**.
- **Anything else** → Tell me exactly what the Terminal or the screen says and I'll
  walk you through it.

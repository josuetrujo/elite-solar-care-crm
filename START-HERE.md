# ▶️ How to Start the Elite Solar Care CRM

A beginner, copy-paste guide to opening your CRM on your computer. You only do the install once; after that it's two steps.

---

## What you need (one-time)
**Node.js** — the engine that runs the app.
1. Go to **https://nodejs.org**
2. Click the big button that says **"LTS"** (Long Term Support).
3. Open the downloaded file and click through the installer (Continue → Agree → Install).
4. **Restart** any open Terminal window afterward.

> Not sure if you already have it? Skip to the steps below — if it's missing, the Terminal will say `command not found: node`, and you just install it then.

---

## Opening the app (every time)

### 1. Open Terminal
Press **Cmd + Space**, type **Terminal**, press **Enter**. A black/white text window opens.

### 2. Go to the project folder
Copy-paste this line exactly (keep the quotes) and press **Enter**:
```
cd "/Users/josuetrujo/Claude/Projects/Elite Solar Care"
```

### 3. First time only — install the building blocks
Copy-paste and press **Enter**. It takes a minute or two; lots of text scrolls by — that's normal.
```
npm install
```
*(You only need to do this the very first time, or after I send you updates.)*

### 4. Start the app
```
npm run dev
```
You'll see a few lines, including one like:
```
➜  Local:   http://localhost:5173/
```

### 5. Open it in your browser
Hold **Cmd** and click that `http://localhost:5173/` link (or type it into Chrome/Safari).
You'll see the **Elite Solar Care** login screen.

### 6. Log in
- Email: **the email you signed up with in Supabase**
- Password: the one you set when you created your user in Supabase.

You're in! You'll see your real customers, the Leads list, Call Mode tools, Callbacks, and the dashboard.

---

## Stopping the app
Click back on the Terminal window and press **Ctrl + C**. The app stops. (Your data is safe in the cloud — nothing is lost.)

To start it again later, just repeat **steps 1, 2, and 4** (you can skip the install).

---

## If something goes wrong
- **`command not found: node` or `npm`** → Node isn't installed. Do the "What you need" step above, then restart Terminal.
- **`cd: no such file or directory`** → The folder path is slightly off. In Finder, find the `Elite Solar Care` project folder, then in Terminal type `cd ` (with a space) and **drag the folder into the Terminal window** — it pastes the correct path. Press Enter.
- **The page says "Loading…" forever or can't log in** → Make sure you created your user in Supabase (Authentication → Users) and are using that exact email/password.
- **Port already in use** → You already have it running in another Terminal tab. Either use that one, or press Ctrl+C there first.
- **Still stuck?** → Tell me exactly what the Terminal says and I'll walk you through it.

---

## What's next (when you're ready)
- Put it **online** so you can use it from your phone → follow **DEPLOY.md**.
- Turn on **card payments** (Square) and **SMS/email reminders** → follow **PAYMENTS-AND-REMINDERS.md**.
  (Printing and saving receipts already works with no setup at all.)

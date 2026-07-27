# 📱 Put the CRM on your phone

Right now the CRM only runs when your Mac's Terminal is open. This puts it on the
internet at a private-ish web address you can open from your phone, your truck, or
any computer — and it saves a backup of the code at the same time.

**Time: about 15 minutes, once.** After this, every change gets published automatically.

---

## Before you start: the one thing to know

GitHub's free plan only publishes websites from **public** repositories. That means
the **code** of the CRM would be readable by anyone.

That is safe here, and here's why:

- **No customer data is in the code.** Your 1,521 contacts live in Supabase, behind a login.
- **No passwords or secret keys are in the code.** Your `.env` file is excluded from the upload.
- The demo names in the code (Maria Gomez, James Carter…) are made up.

Anyone who finds the web address will just see the **login screen**. Without your
Supabase account they see nothing.

> Prefer to keep the code private too? Tell me and I'll switch this to **Cloudflare Pages**
> instead — also free, works with a private repo, takes about the same time.

---

## Step 1 — Make a GitHub account (skip if you have one)

Go to **https://github.com** → Sign up. Use your email. Free plan is fine.

---

## Step 2 — Save the project to GitHub

Open Terminal and copy-paste these lines **one at a time**, pressing Enter after each.

```
cd "/Users/josuetrujo/Claude/Projects/Elite Solar Care"
```

```
git add -A && git commit -m "CRM updates"
```

*(If it says "nothing to commit", that's fine — it just means nothing changed.)*

Now create the online copy. Go to **https://github.com/new** in your browser:

- **Repository name:** `elite-solar-care-crm`
- **Public** (see the note above)
- **Do NOT** check "Add a README file"
- Click **Create repository**

GitHub then shows you a page with commands. Ignore them and copy-paste these instead
(replace `YOUR-USERNAME` with your actual GitHub username):

```
git remote add origin https://github.com/YOUR-USERNAME/elite-solar-care-crm.git
```

```
git branch -M main && git push -u origin main
```

It will ask you to sign in to GitHub in your browser. Do that, and the upload finishes.

---

## Step 3 — Give the website your database keys

The website needs to know how to reach your Supabase database.

1. In your new repo on GitHub, click **Settings** (top right of the repo).
2. Left menu → **Secrets and variables** → **Actions**.
3. Click **New repository secret** and add these two, one at a time.
   The values are the two lines already in your `.env` file — open it in TextEdit and copy them:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the `VITE_SUPABASE_URL` line from `.env` |
   | `VITE_SUPABASE_ANON_KEY` | the `VITE_SUPABASE_ANON_KEY` line from `.env` |

   Paste only the part **after** the `=` sign, with no quotes and no spaces.

---

## Step 4 — Turn the website on

1. Still in **Settings**, left menu → **Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. That's it. Go to the **Actions** tab and watch the "Deploy CRM to GitHub Pages"
   job run. It takes about two minutes and turns green when it's done.

Your address will be:

```
https://YOUR-USERNAME.github.io/elite-solar-care-crm/
```

Open it, log in with your Supabase email and password, and your real customers load.

---

## Step 5 — Put the icon on your phone's home screen

**iPhone:** open the address in Safari → tap the **Share** button (square with an arrow)
→ scroll down → **Add to Home Screen** → **Add**.

**Android:** open it in Chrome → tap the **⋮** menu → **Add to Home screen**.

You now have an Elite Solar Care icon that opens straight into the CRM, full screen,
with no browser bars.

---

## Publishing changes later

Any time the CRM is updated, run these two lines in Terminal:

```
cd "/Users/josuetrujo/Claude/Projects/Elite Solar Care"
```

```
git add -A && git commit -m "updates" && git push
```

Two minutes later the website updates itself. Nothing else to do.

---

## If something goes wrong

- **"git: command not found"** → In Terminal run `xcode-select --install`, click through
  the installer, then try again.
- **The Actions job is red** → Click into it and read the last red line. Usually it means
  a secret in Step 3 was pasted with a stray space or quote mark. Fix it and, on the
  Actions tab, click **Re-run jobs**.
- **The page loads but says "Loading…" forever** → The two secrets are missing or wrong.
  Redo Step 3, then re-run the job.
- **"Page not found" right after the first deploy** → Give it 2–3 minutes; GitHub is still
  publishing. Then hard-refresh (Cmd+Shift+R).
- **Anything else** → Tell me exactly what you see on screen and I'll sort it out.

---

## One more thing: keep the database awake

Supabase's free plan **pauses your database after 7 days with no activity** — that's
what happened while you were away from the project, and it's why the CRM couldn't log in.
Opening the CRM (even just loading the customer list) counts as activity, so normal daily
use keeps it awake on its own. If you're going to be away longer than a week, ask me to
set up an automatic weekly ping.

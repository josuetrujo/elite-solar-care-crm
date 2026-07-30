# 💳 Payments & 📣 Reminders — turning them on

Both features are **already built into the CRM**. They're switched off until you add
the accounts and keys, so nothing can accidentally charge a card or text a customer
before you're ready.

You can do these in either order, or just one of them.

---

## What already works today — no setup at all

**Receipts.** Open a customer → **Invoices & receipts** → **New invoice**. Fill in the
amount, how they paid, and press **Create invoice**. Then press **Receipt** to open a
branded receipt page and save it as a PDF (Cmd+P → "Save as PDF"; on a phone, Share →
Print → pinch out → Share → Save to Files).

It's the same layout as the paper receipts you've been sending, and receipt numbers
continue from **ESC-1002**, so there are no duplicates.

Even better: when you press **Mark done** on a booked cleaning, the CRM creates the
invoice for you automatically using the job's price.

---

# 💳 Part 1 — Card payments (Square)

This lets you email a customer a "Pay now" link instead of chasing a check.

### Step 1 — Get your Square keys

1. Sign in at **https://developer.squareup.com/apps** with your normal Square account.
2. Click **+** to create an application. Name it `Elite Solar Care CRM`.
3. You'll land on the app's page with a **Sandbox / Production** toggle at the top left.
   - Start on **Sandbox** — it's a fake environment for testing. No real money moves.
4. Copy down three things:

   | What | Where to find it |
   |---|---|
   | **Access token** | Credentials page → *Access token* → **Show** |
   | **Location ID** | Locations page → the ID under your business name |
   | **Environment** | the word `sandbox` for now, `production` when you go live |

### Step 2 — Install the Supabase command-line tool (one time)

In Terminal:

```
brew install supabase/tap/supabase
```

*(No Homebrew? Run the install line from https://brew.sh first, then the line above.)*

Then connect it to your project:

```
cd "/Users/josuetrujo/Claude/Projects/Elite Solar Care"
supabase login
supabase link --project-ref iplojxexxtutrllqptil
```

### Step 3 — Store the Square keys as secrets

Secrets live on the server, never in the app, so nobody can read them from a browser.
Replace the `...` parts with your real values:

```
supabase secrets set SQUARE_ACCESS_TOKEN=... SQUARE_LOCATION_ID=... SQUARE_ENVIRONMENT=sandbox
```

### Step 4 — Publish the payment function

```
supabase functions deploy create-square-invoice
```

### Step 5 — Switch it on in the app

Open the `.env` file in the project folder with TextEdit and change this line:

```
VITE_PAYMENTS_ENABLED=true
```

Restart the app (Ctrl+C in Terminal, then `npm run dev`). The **Invoices** screen now
shows a **Square** button on unpaid invoices. Pressing it creates the invoice in Square
and emails the customer a payment link.

> Deployed to the web too? Add `VITE_PAYMENTS_ENABLED` as a repository **variable**
> (GitHub → Settings → Secrets and variables → Actions → **Variables** tab) with the
> value `true`, then push once so the site rebuilds.

### Step 6 — Go live when you're happy

Flip the Square page from *Sandbox* to *Production*, copy the **production** access
token and location ID, and run Step 3 again with `SQUARE_ENVIRONMENT=production`.

**Test first:** in sandbox, send yourself an invoice and pay it with Square's test card
`4111 1111 1111 1111`, any future expiry, any CVV.

---

# 📣 Part 2 — Automatic reminders (text + email)

Reminds customers their panels are due for a cleaning. This is what turns one-time jobs
into recurring revenue without you remembering to call.

> **The law matters here.** You may only text or email someone who has opted in. The CRM
> enforces this: the SMS/Email consent checkboxes on each customer must be ticked, and the
> server double-checks before anything sends. Anyone on Do Not Call is blocked outright.
> The CRM also refuses to send the same reminder twice within 7 days.

### Step 1 — Texting (Twilio)

1. Sign up at **https://www.twilio.com/try-twilio** (free trial credit included).
2. Buy a local phone number: **Phone Numbers → Buy a number** → pick a 916 area code
   number with **SMS** capability (about $1.15/month; texts are roughly a penny each).
3. From the Twilio console home page, copy the **Account SID** and **Auth Token**.

```
supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=+19165551234
```

> ⚠️ US carriers require **A2P 10DLC registration** before business texts go through
> reliably. Twilio walks you through it (Messaging → Regulatory Compliance). Budget a
> few business days for approval — start it early, and don't rely on texting until it clears.

### Step 2 — Email (Resend)

1. Sign up at **https://resend.com** (free tier: 3,000 emails/month).
2. **Domains → Add domain** → `elitesolarcare.com`, then add the DNS records it shows you
   at whoever hosts your domain. This is what stops your emails landing in spam.
3. **API Keys → Create API Key**, copy it.

```
supabase secrets set RESEND_API_KEY=... REMINDER_FROM_EMAIL="Elite Solar Care <admin@elitesolarcare.com>"
```

### Step 3 — Publish the reminder and invoice functions

```
supabase functions deploy send-reminder
supabase functions deploy send-invoice
```

### Step 4 — Switch it on

In `.env`:

```
VITE_SMS_ENABLED=true
VITE_EMAIL_ENABLED=true
```

*(Turn on just one if you only set up one.)* Restart the app.

Now every customer page has **Text reminder** and **Email reminder** buttons. They stay
greyed out until that customer has ticked the matching consent box and has a phone number
or email on file.

---

## Emailing an invoice or receipt

Every invoice has an **Email** button (on the customer's page and on the Invoices screen),
and the New-invoice form has **Create & email**. It works two ways, and you don't have to
choose — the CRM picks whichever is available:

| | What happens |
|---|---|
| **Before Resend is set up** | Your own email app opens (Mail, Gmail, Outlook) with the customer's address, the subject and a plain-text copy of the receipt already filled in. You press Send. Works today, nothing to configure. |
| **After Resend is set up** (`VITE_EMAIL_ENABLED=true` + `supabase functions deploy send-invoice`) | The CRM emails the branded receipt itself, records the send against the customer, and an **unpaid** invoice becomes **sent**. |

The `send-invoice` function decides who the receipt goes to by re-reading the invoice and
customer in the database, so a browser can never redirect a receipt somewhere else, and it
only runs for a signed-in, approved admin or member.

**Consent:** a receipt for work already done is a *transactional* email, so it does not
need the marketing email opt-in. The `consent_email` box gates reminders and follow-ups,
which is where it legally belongs.

---

## Saving an invoice as a PDF

Press **PDF** on any invoice (or **Create & download PDF** on a new one). The receipt is
rendered off-screen and your browser's print box opens — choose **Save as PDF** as the
destination. On a phone, use the Share button and **Save to Files**. The suggested filename
is the receipt number and the customer's name, e.g. `Receipt ESC-1003 — Sofia Reyes.pdf`.

There is no separate PDF library to install, and because it's the same sheet either way,
a printed copy and a saved copy always match. **Receipt** opens the same page in a tab if
you'd rather look at it before saving.

---

## Where to collect consent

Ask on the call — "Can I text you a reminder when your panels are due?" — and tick the
box on their page. That single sentence is what makes the whole reminder system legal and
is worth building into your call script.

---

## Troubleshooting

- **"Twilio secrets are not set in Supabase"** → Step 1's `supabase secrets set` didn't run,
  or ran before `supabase link`. Run `supabase secrets list` to see what's actually stored.
- **"This customer has not opted in to text messages"** → Tick SMS consent on their page
  and press Save.
- **"A reminder like this already went out in the last 7 days"** → Working as designed.
- **Square says "unauthorized"** → The token is a Sandbox token but `SQUARE_ENVIRONMENT` is
  `production` (or the reverse). They must match.
- **Buttons still don't appear after editing `.env`** → The app only reads `.env` at startup.
  Stop it with Ctrl+C and run `npm run dev` again.
- **Anything else** → Tell me the exact message on screen and I'll fix it.

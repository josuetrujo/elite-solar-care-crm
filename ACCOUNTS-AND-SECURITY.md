# 🔐 Accounts, your crew, and keeping the data private

Read this once before the CRM goes on the public internet. It's short.

---

## The problem this solves

Your customer list is 1,521 names, phone numbers and home addresses. That is the
most sensitive thing in the business, and it deserves a real lock.

Here's the part that isn't obvious: your sign-in screen not having a "sign up"
button **does not stop anyone signing up**. The database has its own front door
(an internet address that's inside the app's code, because the browser needs it),
and by default that door accepts new accounts from anyone who knocks.

So the lock can't live in the sign-in screen. It has to live in the database.

---

## How it works now

Every new account starts with **zero access**. Not "read-only" — zero. The
database itself returns nothing: no customers, no phone numbers, no call history,
no invoices. A stranger who signs up sees a screen saying "waiting for approval"
and nothing else, forever, unless you approve them.

You approve people in **Settings → Team**.

This was tested, not assumed: an unapproved account querying the customer table
gets 0 rows back, while yours gets all 1,521.

---

## Adding someone to your crew

1. Send them the CRM's web address.
2. They tap **Create an account** on the sign-in screen and choose their own password.
   (They pick it — you never handle anyone's password.)
3. Their name appears in **Settings → Team** under *Waiting for approval*.
4. Tap **Approve**, then set their role.

### Which role?

| Role | Can do | Give it to |
|---|---|---|
| **Admin** | Everything, including approving people and deleting contacts | You. Only you, unless there's a real reason. |
| **Member** | Call, log outcomes, book jobs, edit customers, create invoices | Your two crew members |
| **Viewer** | Look at everything, change nothing | A bookkeeper, or someone you're training |

**Removing someone** is one tap on the same screen — press **Remove** and they're
locked out immediately, without deleting their history of who called whom.

---

## If you forget your password

Tap **Forgot your password?** on the sign-in screen. You'll get an email with a
link; the link opens the CRM and asks you to pick a new password. That's it —
you're no longer dependent on me or on the Supabase dashboard to get back in.

> **Free-plan email limit:** Supabase's built-in mail service sends at most two
> authentication emails per hour for the entire project. If the CRM says the
> email limit was reached, stop retrying, wait a full hour, and request exactly
> one new link. Repeated clicks do not shorten the wait. A custom SMTP provider
> is the long-term production fix for this low limit.

> **One-time setup so those emails work.** In Supabase → **Authentication** →
> **URL Configuration**, add your CRM's address to **Redirect URLs**:
> ```
> https://YOUR-USERNAME.github.io/elite-solar-care-crm/**
> http://localhost:5173/**
> ```
> Without this the reset link will open and then refuse to set the password.
> Do this at the same time as the deploy in `DEPLOY.md`.

---

## Two settings worth turning on in Supabase

Both are in the Supabase dashboard, both take a few seconds:

1. **Authentication → Sign In / Providers → Confirm email: ON.** Means someone has
   to prove they own an email address before an account exists at all. Combined with
   the approval gate, that's two locks.
2. **Authentication → Attack Protection → Leaked password protection: ON.** Checks
   new passwords against the public list of passwords stolen in past breaches, and
   refuses them. Free, and it stops the single most common way small businesses get
   broken into.

---

## What is deliberately *not* secret

The database address and the "anon key" are in the app's code, where anyone can
read them. **That's normal and safe.** They're the equivalent of a public street
address: knowing where the building is gets you nothing, because the locks
(the approval gate and the permission rules) are on the doors inside.

The keys that *are* secret — Square, Twilio, Resend — never touch the browser.
They live in Supabase's secret storage and are only ever used server-side.

---

## If you ever think something's wrong

Signs worth acting on: someone in **Settings → Team** you don't recognise, or a
customer count that drops sharply (the twice-weekly database check will tell you).

If either happens: open **Settings → Team** and press **Remove** on anyone who
shouldn't be there — that cuts their access instantly. Then mention it in a Claude
session and I'll go through the logs with you.

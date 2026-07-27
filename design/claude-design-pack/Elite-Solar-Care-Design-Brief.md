# Elite Solar Care CRM — Design Brief
*(Attach this file to Claude Design along with the 5 images in this folder.)*

## The business
**Elite Solar Care LLC** — professional **solar panel cleaning & bird proofing** in the Sacramento / Bay Area. Small team (owner + 2). The CRM is used to call leads, track customers, schedule recurring cleanings, and send invoices. It must work great on **a phone in the field** and on a **laptop**.

## Brand
- **Logo:** a sun/solar mark with the words "ELITE SOLAR CARE" (see `01-logo.png`). Works on black or white.
- **Colors (use these exact values):**
  - Primary Blue: `#004AAD`
  - Sun Orange: `#EC5002`
  - Amber/Gold: `#FF8900` (orange→amber gradient is the signature accent)
  - Ink/Black: `#0B0B0C`
  - Surface/White: `#FFFFFF`, light gray `#F5F7FA`
- **Feel:** clean, modern, trustworthy, high-contrast and legible in bright sunlight. Rounded corners, generous spacing, big tap targets. A touch of the sun-gradient as accent, not everywhere.
- **Tagline options:** "Solar Panel Cleaning & Bird Proofing" · "Keep your panels producing."

## Who uses it
- **Owner/admin** — does everything, manages the team.
- **Member** — calls leads, logs calls, books jobs.
- **Viewer** — read-only.
Designs should feel approachable for a **non-technical** user.

## What to design (screens)
1. **Login** — simple, branded.
2. **Dashboard** — totals (customers, due soon, overdue), pipeline at a glance, "Callbacks due today" alert, "needs attention" list.
3. **Leads (call list)** — searchable/filterable table or card list of people to call.
4. **Call Mode** ⭐ (the hero screen) — shows ONE lead at a time for rapid calling: name, phone (tap-to-call), address, # panels, last note, and **big outcome buttons**: *No Answer, Voicemail, Busy, Call Later, Not Interested, Wrong Number, DNC, SALE*. A notes box. Auto-advances to the next lead. Optimize for one-handed phone use.
5. **Contact detail** — full profile (contact, system details, pipeline status, quote), a **call-history timeline**, the same outcome buttons, and consent toggles.
6. **Sale form** (modal) — pops up on SALE: panel count, price, notes, cleaning subscription (twice a year default / quarterly / annual).
7. **Callbacks** — leads with scheduled call-backs, grouped Overdue / Today / Upcoming.
8. **Customers** — won customers; next service due.
9. **Schedule** — upcoming/overdue cleanings.
10. **Invoices** — list + status (Square-powered later).
11. **Settings** — connections on/off, team & roles.
12. Small **secondary lists**: Do Not Call, Lost, Bad Number.

## The calling workflow (important)
Each contact is called manually; the app logs the outcome. Pressing a button stamps date/time, saves a note, and moves the contact to the right list:
- No Answer / Voicemail / Busy → stays in Leads
- Call Later → set date+time → shows in Callbacks
- Not Interested → Lost list · Wrong Number → Bad Number list · DNC → hidden Do-Not-Call list
- SALE → Customers list (+ capture panels/price/subscription)

## Technical context (so designs map to code)
The app is **React + Tailwind CSS** (already scaffolded). Favor standard Tailwind-friendly patterns: cards, rounded-xl, subtle shadows, a left sidebar on desktop that collapses to a bottom/hamburger nav on mobile. Mobile-first.

## Attached reference images
- `01-logo.png` — primary logo
- `02-business-card-front.png` / `03-business-card-back.png` — brand colors & type in use
- `04-flyer.png` — marketing style reference
- `05-qr-code.png` — brand QR

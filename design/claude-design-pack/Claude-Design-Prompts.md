# How to design the CRM in Claude Design — step by step

You're new to this, so here's the whole flow. **Claude Design can't open files on your computer** — you upload images/docs into it (like attaching to a chat), or point it at a GitHub repo. Everything you need is in this folder.

## Before you start
1. Open **Claude Design** (claude.ai → Claude Design / Anthropic Labs; included with your Claude plan).
2. Start a **new design project.**
3. **Attach these 6 files** from this folder:
   - `Elite-Solar-Care-Design-Brief.md`
   - `01-logo.png`, `02-business-card-front.png`, `03-business-card-back.png`, `04-flyer.png`, `05-qr-code.png`
   *(Tip: if it won't take the .md, just copy-paste the brief's text into the first message.)*

---

## PROMPT 1 — kick off (paste this)
> I'm designing a CRM web app for my solar panel cleaning business, **Elite Solar Care**. I've attached my logo, business cards, a flyer, and a design brief. Please **extract my brand colors and style** from these and set up a design system (colors, typography, buttons, cards) I can reuse.
>
> Brand colors to use: Primary Blue `#004AAD`, Sun Orange `#EC5002`, Amber `#FF8900`, on white/light-gray surfaces. Clean, modern, trustworthy, high-contrast for outdoor phone use. Rounded corners, big tap targets, mobile-first.
>
> Start by designing the **Dashboard** screen (desktop + mobile), using the brief's description. Show me 2 style directions so I can pick.

## PROMPT 2 — the hero screen (Call Mode)
> Now design **Call Mode** — the most important screen. It shows ONE lead at a time for fast phone calling. Include: the person's name, a big tap-to-call phone number, their address and number of solar panels, their last call note, and a row of large outcome buttons: **No Answer, Voicemail, Busy, Call Later, Not Interested, Wrong Number, DNC, and a prominent SALE button**. Add a notes text box. After I pick an outcome it should advance to the next lead. Design it for **one-handed phone use first**, then a desktop version.

## PROMPT 3 — contact detail + call history
> Design the **Contact Detail** screen: contact info, system details (panels, stories, roof type), pipeline status, quoted price, consent toggles for SMS/email, and a **call-history timeline** showing each past call with its date, outcome, and note. Include the same outcome buttons at the top.

## PROMPT 4 — the SALE moment
> Design the **Sale form** that pops up when I press SALE: fields for panel count, price, notes, and a cleaning **subscription** choice (Twice a year / Quarterly / Annual / One-time). Make it quick to fill on a phone.

## PROMPT 5 — the lists
> Design the **Leads** list (searchable, filter by status) and simple versions of the **Callbacks**, **Customers**, **Schedule**, and **Settings** screens described in the brief. Keep them consistent with the design system.

---

## Refining (how to iterate)
- **Comment on any element** and tell Claude what to change ("make the SALE button bigger and gold").
- Use the **adjustment knobs** to tweak spacing/color live.
- Ask: *"Apply this button style across all screens."*
- Ask for **both mobile and desktop** versions of each screen.

## When you're happy
- **Export to HTML** (or share the project link) and give it back to me here.
- Even better: once the CRM repo is on **GitHub**, you can point Claude Design at the repo so its designs match the real components — then I turn the designs into working code in the app.

## What NOT to worry about
- Don't design the database or logic — that's already built. Claude Design is just for the **look and feel**.
- You can't break anything; explore freely and try different looks.

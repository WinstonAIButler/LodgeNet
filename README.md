# LodgeNet

A platform that gives Masonic lodges their own website, a merch store that funds their charities, a calendar for Stated Communications and public fundraisers, and a Secretary's desk for meeting minutes.

This repo currently holds the static prototype site:

- `index.html`: home page
- `features.html`: detail on the website, store, calendar and minutes tools
- `demo.html`: interactive demo with a sample lodge (`/demo#store`, `#calendar`, `#members`, `#minutes` open a tab directly)
- `pricing.html`: pick a plan ("Start now" in the header lands here) and FAQ
- `start.html`: a new, blank lodge in the dashboard layout; `/start?plan=starter|lodge|district` (Starter hides the store)
- `lodges/murrells-inlet-368.html`: dashboard for Murrells Inlet Lodge No. 368 (served at `/lodges/murrells-inlet-368`). Each lodge page sets `window.LODGE` (name, Grand Lodge, members, officer seats, events, store items) before loading `assets/demo.js`
- `assets/styles.css` and `assets/demo.js`: shared styles and demo logic
- `assets/vendor/jspdf.umd.min.js`: jsPDF 2.5.1 (MIT), loaded only when someone saves minutes as a PDF

Edits on the demo and lodge pages save automatically in the viewer's browser (localStorage, one key per page). The bar under the dashboard header can Export them as JSON, Import a JSON export, or Start over. To make an export a lodge's permanent starting data, copy its values into that lodge page's `window.LODGE`. Checkout takes no payment.

### Minutes

The Secretary fills in a short form; the full Stated Communication write-up (and the PDF) is generated from it in the lodge's template wording. Each part of the minutes is a section plugin in the `MS` list in `assets/demo.js`: its fields, plus how it reads in `longForm()`. Opening, attendance, previous minutes and closing are always on; the rest can be switched on or off per lodge with the Sections button (saved as `minuteSections`). Anything left blank on the short form is left out of the write-up. Minutes saved in the old free-text format are converted on load.

## Deploy

The site is static, so Vercel serves it with no build step. Import this repo in Vercel (Add New → Project), keep the framework preset at "Other", and deploy. Every push to `main` redeploys. `vercel.json` turns on clean URLs, so pages are served at `/features`, `/demo` and `/pricing`.

## Run locally

Run `npx serve .` from the repo root (it also serves clean URLs). Opening the files directly won't resolve the `/assets/...` paths.

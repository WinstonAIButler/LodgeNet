# LodgeNet

A platform that gives Masonic lodges their own website, a merch store that funds their charities, a calendar for Stated Communications and public fundraisers, and a Secretary's desk for meeting minutes.

This repo currently holds the static prototype site:

- `index.html`: home page
- `features.html`: detail on the website, store, calendar and minutes tools
- `demo.html`: interactive demo with a sample lodge (`/demo#store`, `#calendar`, `#members`, `#minutes` open a tab directly)
- `pricing.html`: proposed plans and FAQ
- `lodges/murrells-inlet-368.html`: dashboard for Murrells Inlet Lodge No. 368 (served at `/lodges/murrells-inlet-368`). Each lodge page sets `window.LODGE` (name, Grand Lodge, members, officer seats, events, store items) before loading `assets/demo.js`
- `assets/styles.css` and `assets/demo.js`: shared styles and demo logic

Edits on the demo and lodge pages save automatically in the viewer's browser (localStorage, one key per page). The bar under the dashboard header can Export them as JSON, Import a JSON export, or Start over. To make an export a lodge's permanent starting data, copy its values into that lodge page's `window.LODGE`. Checkout takes no payment.

## Deploy

The site is static, so Vercel serves it with no build step. Import this repo in Vercel (Add New → Project), keep the framework preset at "Other", and deploy. Every push to `main` redeploys. `vercel.json` turns on clean URLs, so pages are served at `/features`, `/demo` and `/pricing`.

## Run locally

Run `npx serve .` from the repo root (it also serves clean URLs). Opening the files directly won't resolve the `/assets/...` paths.

# LodgeNet

A platform that gives Masonic lodges their own website, a merch store that funds their charities, a calendar for Stated Communications and public fundraisers, and a Secretary's desk for meeting minutes.

This repo currently holds the prototype: a single static page (`index.html`) with a marketing site and an interactive demo using a sample lodge. Demo changes are kept in the browser only, and checkout takes no payment.

## Deploy

The site is static, so Vercel serves it with no build step. Import this repo in Vercel (Add New → Project), keep the framework preset at "Other", and deploy. Every push to `main` redeploys.

## Run locally

Open `index.html` in a browser, or run `npx serve .`.

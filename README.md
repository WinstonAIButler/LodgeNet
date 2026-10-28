# LodgeNet

A platform that gives Masonic lodges their own website, a merch store that funds their charities, a calendar for Stated Communications and public fundraisers, and a Secretary's desk for meeting minutes.

This repo currently holds the static prototype site:

- `index.html`: home page
- `features.html`: detail on the website, store, calendar and minutes tools
- `demo.html`: interactive demo with a sample lodge (`/demo#store`, `#calendar`, `#members`, `#minutes` open a tab directly)
- `pricing.html`: pick a plan ("Start now" in the header lands here) and FAQ
- `owner.html`: the private owner's hub at `/owner` (see Owner's hub below), with `assets/owner.js`. Not linked from the site's menu
- `login.html`: the Login tab. Sign in, create an account, reset a password, and see "My lodges"; a lodge's account owner manages its roll and invites here
- `start.html`: a new, blank lodge in the dashboard layout; `/start?plan=starter|lodge|district` (Starter hides the store)
- `lodges/murrells-inlet-368.html`: dashboard for Murrells Inlet Lodge No. 368 (served at `/lodges/murrells-inlet-368`). Each lodge page sets `window.LODGE` (name, Grand Lodge, members, officer seats, events, store items) before loading `assets/demo.js`
- `assets/styles.css` and `assets/demo.js`: shared styles and demo logic
- `assets/auth.js` and `assets/login.js`: sign-in (see Accounts below); `api/config.js` is the one Vercel function; `api/_public.js` holds the live Supabase project URL and public key, used when Vercel has no `SUPABASE_*` variables
- `supabase/schema.sql`: accounts database; `supabase/murrells-inlet-368.sql` adds that lodge
- `assets/vendor/supabase.umd.min.js`: supabase-js 2.117.3 (MIT)
- `assets/vendor/jspdf.umd.min.js`: jsPDF 2.5.1 (MIT), loaded only when someone saves minutes as a PDF

Edits on the demo and lodge pages save automatically in the viewer's browser (localStorage, one key per page). The bar under the dashboard header can Export them as JSON, Import a JSON export, or Start over. To make an export a lodge's permanent starting data, copy its values into that lodge page's `window.LODGE`. Checkout takes no payment.

### Minutes

The Secretary fills in a short form; the full Stated Communication write-up (and the PDF) is generated from it in the lodge's template wording. Each part of the minutes is a section plugin in the `MS` list in `assets/demo.js`: its fields, plus how it reads in `longForm()`. Opening, attendance, previous minutes and closing are always on; the rest can be switched on or off per lodge with the Sections button (saved as `minuteSections`). Anything left blank on the short form is left out of the write-up. Minutes saved in the old free-text format are converted on load.

## Accounts

Lodges sign in with Supabase (Auth for email and password, Postgres for the lodge's data). `/api/config` gives the browser the project URL and public key from Vercel's environment (`SUPABASE_URL` and `SUPABASE_ANON_KEY`, or the `NEXT_PUBLIC_` / publishable-key names the Vercel Supabase integration sets). With neither set, the site runs browser-only exactly as before and `/login` says sign-in isn't switched on.

- A lodge row in `lodges` holds its plan (`starter`, `lodge` or `district`) and its dashboard as one JSON document in `data`, the same shape as an Export.
- `lodge_members` gives each account a role on a lodge: `owner` manages the roll, `officer` edits, `member` reads. Row Level Security enforces it, and the site can only change `lodges.data`, so plans are set in SQL.
- The owner invites by email from `/login`. The brother chooses Create account with that email, and once the email is confirmed the invite becomes a membership (`claim_invites()`).
- A lodge page sets `slug` in `window.LODGE` and loads `<script src="/assets/auth.js" data-app="/assets/demo.js">`: the dashboard opens only for that lodge's members and saves to the account. The first officer to sign in carries any edits saved in their browser up to the account.
- Plan codes: an owner enters a code under My lodges (Pricing links to `/login#code`) and `redeem_plan_code()` puts the lodge on the code's plan at no charge (`lodges.comped`). Codes are added in the SQL editor, e.g. `insert into plan_codes(code,plan,max_uses) values('LODGE-XXXX-XXXX','lodge',10)`, and can't be read from the site. Keep real codes out of this repo.
- Billing: `api/billing.js` sends an owner to Stripe Checkout for the $19 / month Lodge plan, opens the Stripe Customer Portal for "Manage billing", and on return reads the subscription back from Stripe into `lodges.billing_status` (no webhook). It needs `SUPABASE_SERVICE_ROLE_KEY` and a Stripe secret key: `STRIPE_SECRET_KEY` from Vercel's Stripe integration, or the one saved in the owner's hub. Save the Customer Portal settings once in the Stripe Dashboard before using Manage billing. Comped lodges never see Subscribe.
- Saves replace the whole document, so if two officers edit at the same moment the later save wins.

Setup: create a Supabase project (or add the Supabase integration in Vercel, which sets the variables), run `supabase/schema.sql` then the lodge's SQL in the SQL editor, and under Authentication → URL Configuration set the Site URL to the live domain and add `https://*.vercel.app/**` as a redirect URL for previews.

## Owner's hub

`/owner` is the LodgeNet owner's view of every lodge (plan, no-charge flag, brethren, account owner), every account, the plan codes, and the Stripe API key. Run `supabase/owner-hub.sql` after `schema.sql`, with the owner's email in place of `ADMIN_EMAIL`, then sign in at `/owner` with that account (create it at `/login` first and confirm the email).

- Privacy is enforced in the database: the hub calls `admin_*` functions that refuse anyone whose confirmed email isn't in `platform_admins`. That table can't be read or changed from the site; add another owner in the SQL editor.
- The hub can change a lodge's plan and no-charge flag, add a lodge with its owner's invite (the page at `lodges/<slug>.html` is still added in the repo), and create or end plan codes.
- The Stripe key is write-only: it's kept in `platform_secrets` (row `stripe_secret_key`), which only the service role can read; the hub sees just test/live and the last four characters. Server code should use Vercel's `STRIPE_SECRET_KEY` when it's set and this row otherwise.
- Revenue figures are at list price from the plans until Stripe billing is live.

## Deploy

The site is static, so Vercel serves it with no build step. Import this repo in Vercel (Add New → Project), keep the framework preset at "Other", and deploy. Every push to `main` redeploys. `vercel.json` turns on clean URLs, so pages are served at `/features`, `/demo` and `/pricing`.

## Run locally

Run `npx serve .` from the repo root (it also serves clean URLs). Opening the files directly won't resolve the `/assets/...` paths.

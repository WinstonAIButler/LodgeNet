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
- `assets/brand/`: the LodgeNet logo. `lodgenet-logo.png` is the full crest and wordmark on a transparent background (for light backgrounds), `lodgenet-crest.webp` is the crest alone, used in every page's header. `favicon.ico`, `apple-touch-icon.png`, `assets/brand/icon-192.png` and the 1200×630 social preview `og-image.png` are cut from the same crest. The site's colors come from it: slate blue `#3b5870` / `#4e6a83`, gold `#c9a54e` (`#856823` for gold text on light backgrounds), and a diamond checkered floor; headings and the wordmark are Montserrat
- `assets/auth.js` and `assets/login.js`: sign-in (see Accounts below); `api/config.js` is the one Vercel function; `api/_public.js` holds the live Supabase project URL and public key, used when Vercel has no `SUPABASE_*` variables
- `supabase/schema.sql`: accounts database; `supabase/murrells-inlet-368.sql` adds that lodge
- `assets/vendor/supabase.umd.min.js`: supabase-js 2.117.3 (MIT)
- `assets/vendor/jspdf.umd.min.js`: jsPDF 2.5.1 (MIT), loaded only when someone saves minutes as a PDF

Edits on the demo and lodge pages save automatically in the viewer's browser (localStorage, one key per page). The bar under the dashboard header can Export them as JSON, Import a JSON export, or Start over. To make an export a lodge's permanent starting data, copy its values into that lodge page's `window.LODGE`. Checkout takes no payment.

### Minutes

The Secretary fills in a short form; the full Stated Communication write-up (and the PDF) is generated from it in the lodge's template wording. Each part of the minutes is a section plugin in the `MS` list in `assets/demo.js`: its fields, plus how it reads in `longForm()`. Opening, attendance, previous minutes and closing are always on; the rest can be switched on or off per lodge with the Sections button (saved as `minuteSections`). Anything left blank on the short form is left out of the write-up. Minutes saved in the old free-text format are converted on load.

### Website builder and QR codes

The Website tab works the way Wix does (`assets/site-builder.js`):

- **Overview** (the tab itself): a live thumbnail of the site with its address and status, Edit site, Preview and QR codes. Below that are a "Let's get your site live" checklist with a progress ring (name and meeting time, logo, banner picture, About text, a second page, Publish), where each step jumps to the right spot in the editor. Then "Start from a design": five whole-site designs made for lodges (Traditional Lodge, Bold Community, Heritage, Modern Charity, Fundraising Focus, in `LodgeSite.SITE_TEMPLATES`), each shown as a live thumbnail. Using one keeps the lodge's banner and gallery photos, and Undo brings the old site back.
- **Bring over your current website** (overview): the officer pastes the old site's address and picks LodgeNet extras: a lodge store with their merchandise, online giving, the events calendar, fundraisers, and a Become a Mason page. `api/site-import.js` with `rebuild:true` reads up to 10 pages of the old site (menu pages first, skipping login, cart and policy pages) and its colors (theme-color, inline styles, up to three stylesheets). Claude then rebuilds each page as sections, keeping the site's own words, pictures and order, and picks the brand color, font style and header. The response carries the pictures the pages use (up to about 3.9 MB). It also fills in lodge details, officers, upcoming events and store items as before. The builder turns that into pages and adds the chosen extras, and Undo brings back the previous site. Nothing goes live until Publish.
- **Pages from your dashboard** (overview): switches for Events, Fundraisers, Lodge store, Charities, Officers, Sponsors and News pages. Turning one on builds that page from sections that fill themselves in from that tab, and turning it off takes the page away. **Keep the live site up to date automatically** (on by default, `siteLayout.autoSync`): on every save, the live parts of the published copy (events, fundraisers, store, charities, active sponsors, public announcements, officers, giving and meeting details) are refreshed from the dashboard, so adding or deleting an event shows on the site without pressing Publish. Design changes still wait for Publish. Sponsors publish only their name and level, and news only announcements whose audience is Public.
- **Edit site** opens a full-screen editor at `#website/edit`, so the browser's Back button closes it. Top bar: back to the dashboard, Undo/Redo, Preview, Publish. A toolbar row: + Add, and for the selected section Change layout, Background, picture, Edit, move, Duplicate and Delete. An icon rail slides out the Add, Pages, Design and Lodge info panels. The browser frame's bar has the page picker and Desktop/Phone. The selected section shows its name chip and an Add Section button on its bottom edge.

The middle of the editor is the real site, drawn by `assets/site-render.js` with `assets/lodge-site.css`, the same code and styles the public site at `/site/<slug>` uses (`lodge-site.html`, `assets/lodge-site.js`). What an officer edits is exactly what visitors get.

- **On the page**: click any text to type over it, click a section to edit it in the left panel, use the toolbar on a section to move, duplicate or delete it (or drag it by its handle), and use the + between sections to add one there. Undo/Redo (also Ctrl/Cmd+Z), Desktop/Phone views, and Preview without the editing outlines.
- **Add**: a library of sections, each added by clicking or by dragging onto the page. Banner (words centered or left over a picture, or beside it), Text, Picture and text, Three columns, Call to action, Photo gallery (up to 24 photos), Video (YouTube/Vimeo), and lodge sections that fill themselves in from the dashboard: Upcoming events, Fundraisers, Officers, Contact and meetings, Give, and Lodge store. Plus Custom HTML.
- **Design**: the five site designs, lodge color (swatches or any color), fonts (Modern, Classic, Heritage), rounded or square buttons, centered or logo-left header, and the logo.
- **Page templates** (`LodgeSite.TEMPLATES`, shown in the Pages panel as live thumbnails in four groups):
  - **Basics:** Blank, About, Our history (with a Past Masters list), Contact.
  - **Lodge life:** Events, Become a Mason, Visiting brethren, Officers, Newsletter (Trestleboard), Photo gallery.
  - **Giving:** Donations, Fundraiser, Pay dues, Scholarships, Lodge store, Hall rental.
  - **Members:** Members only.

  Buttons can open "Email the lodge" (`email`, resolved to the lodge's email address).
- **Pay dues** section: this year's dues from Treasury → Dues, with PayPal, Venmo and Cash App buttons that pre-fill the amount, plus Zelle and check instructions. The amount is published only when a dues section is on a public page.
- **Members-only pages** (the Members template, or "Members only" in a page's settings): the public copy carries only the page's title and address, and the menu shows a lock. Publish keeps the page's sections, with brethren's news and the dues amount, in `published.members`, beside `published.site`. `published_site()` never returns it. On the public site, `assets/lodge-site.js` signs the visitor in through the lodge portal's session and calls `members_page()` (`supabase/members-pages.sql`), which answers only an account on that lodge's roll while the plan is paid. Everyone else gets a sign-in screen, or a "not on this lodge's roll" message. Run `supabase/members-pages.sql` once to switch this on; until then, members pages say they aren't switched on yet, and their content stays private either way.
- **Pages**: add pages from the templates above, rename them, change their address, show or hide them in the menu, reorder them and delete them. Home is always first.
- **Lodge info**: the lodge details form (name, number, Grand Lodge, meetings, email, social, and build from a current website).
- Buttons store links as `home`, `page:<id>`, `fund:<id>` or a web address, and they're resolved when the page is drawn, so renaming a page never breaks one.
- Custom HTML runs in a sandboxed iframe without `allow-same-origin`, so it can't read LodgeNet sign-ins, cookies or records on `www.lodgenet.app`. Up to 200 KB per section.
- Saved as `siteLayout` `{v:2, theme, pages:[{id,slug,title,nav,sections}]}` in the lodge's data. Publish copies it into `published.site.layout` with `funds`, `store` and `qrs`. A lodge published before the builder still renders: Home is built from its About text, banner, gallery and store (`LodgeSite.defaultHome`), and the first time the builder opens it moves the banner and gallery into that Home.
- Layout responds to the width of the site (CSS container queries), so the Phone view is the real phone layout.
- **QR codes** have their own sidebar tab (`assets/site-qr.js`). Each code encodes `/site/<slug>/qr/<id>` and the published site redirects it to wherever it's assigned: Home, a page, a fundraiser (`/site/<slug>/fundraiser/<id>`) or a link. Reassigning a printed code only takes Publish. Codes download as PNG or SVG. Fundraiser cards have a QR code button. Deleting a page points its codes at Home.
- Photos are kept as data URLs inside the lodge's one JSON document, so a site with many pictures makes every save larger. Supabase Storage is the next step if lodges hit that.

### Organization types

Settings → **Organization type** sets what kind of Masonic body the dashboard serves (`assets/org.js`, saved as `org` in the lodge's data):
- **Craft Lodges:** Blue Lodge, Prince Hall Lodge.
- **Scottish Rite:** Scottish Rite Valley, Scottish Rite Club (nonprofit).
- **York Rite:** Royal Arch Chapter, Cryptic Council, Commandery of Knights Templar, or all York Rite bodies together.

The type sets:
- the unit's name and whether it's numbered;
- the officer chairs (and how Members lays them out);
- the regular meeting's name (Stated Communication, Stated Meeting, Stated Convocation, Stated Assembly, Stated Conclave, Club Meeting) on the calendar, the minutes tab and write-ups ("Meeting notes" for a club), and the website;
- the governing body, filled in from the state: a Valley gets its Orient and the Supreme Council, Northern Masonic Jurisdiction for the 15 NMJ states and Southern Jurisdiction for the rest; York Rite bodies get their Grand Chapter, Council or Commandery;
- the roll's degrees and honorifics, and who can hold office;
- the membership pipeline's stages and the stats on Members, Communications and Pipelines;
- the website's joining page and the "Past Masters" wording.

A club also gets a Tax ID (EIN) field, shown beside its giving buttons. The import sends the type's chairs to Claude, so a Valley's officers match its own chairs.

Choosing a type saves and reloads the dashboard. Members, events, money, minutes and the website stay. Seated officers are kept by chair and return if the type is switched back.

## Accounts

Lodges sign in with Supabase (Auth for email and password, Postgres for the lodge's data). `/api/config` gives the browser the project URL and public key from Vercel's environment (`SUPABASE_URL` and `SUPABASE_ANON_KEY`, or the `NEXT_PUBLIC_` / publishable-key names the Vercel Supabase integration sets). With neither set, the site runs browser-only exactly as before and `/login` says sign-in isn't switched on.

- A lodge row in `lodges` holds its plan (`starter`, `lodge` or `district`) and its dashboard as one JSON document in `data`, the same shape as an Export.
- `lodge_members` gives each account a role on a lodge: `owner` manages the roll, `officer` edits, `member` reads. Row Level Security enforces it, and the site can only change `lodges.data`, so plans are set in SQL.
- The owner invites by email from `/login`. The brother chooses Create account with that email, and once the email is confirmed the invite becomes a membership (`claim_invites()`).
- A lodge page sets `slug` in `window.LODGE` and loads `<script src="/assets/auth.js" data-app="/assets/demo.js">`: the dashboard opens only for that lodge's members and saves to the account. The first officer to sign in carries any edits saved in their browser up to the account.
- Plan codes: an owner enters a code under My lodges (Pricing links to `/login#code`) and `redeem_plan_code()` puts the lodge on the code's plan at no charge (`lodges.comped`). Codes are added in the SQL editor, e.g. `insert into plan_codes(code,plan,max_uses) values('LODGE-XXXX-XXXX','lodge',10)`, and can't be read from the site. Keep real codes out of this repo.
- Billing: `api/billing.js` sends an owner to Stripe Checkout for the $19 / month Lodge plan, opens the Stripe Customer Portal for "Manage billing", and on return reads the subscription back from Stripe into `lodges.billing_status` (no webhook). It needs `SUPABASE_SERVICE_ROLE_KEY` and a Stripe secret key: `STRIPE_SECRET_KEY` from Vercel's Stripe integration, or the one saved in the owner's hub. Save the Customer Portal settings once in the Stripe Dashboard before using Manage billing. Comped lodges never see Subscribe.
- Saves replace the whole document, so if two officers edit at the same moment the later save wins.

Setup: create a Supabase project (or add the Supabase integration in Vercel, which sets the variables), run `supabase/schema.sql` then the lodge's SQL in the SQL editor, and under Authentication → URL Configuration set the Site URL to the live domain (`https://www.lodgenet.app`), add `https://www.lodgenet.app/**` and `https://lodgenet.app/**` as redirect URLs, and add `https://*.vercel.app/**` for previews.

Domain: the live site is `https://www.lodgenet.app` (`lodgenet.app` redirects to it, and `vercel.json` sends `lodgenet.vercel.app` there too). Canonicals, JSON-LD, `sitemap.xml`, `robots.txt` and `llms.txt` hard-code it; to move domains run `scripts/set-domain.sh https://new.domain` and update the host redirect in `vercel.json`. Stripe return URLs and Supabase email links use the visiting host, so they follow automatically.

## Owner's hub

`/owner` is the LodgeNet owner's view of every lodge (plan, no-charge flag, brethren, account owner), every account, the plan codes, and the Stripe API key. Run `supabase/owner-hub.sql` after `schema.sql`, with the owner's email in place of `ADMIN_EMAIL`, then sign in at `/owner` with that account (create it at `/login` first and confirm the email).

Handing a lodge to a new account owner (a new Worshipful Master or Secretary): run `supabase/handover.sql` once. The account owner then uses **Hand over this lodge** under My lodges (`/login?account`), and the LodgeNet owner uses **Change owner** under Manage on `/owner`. Someone not yet on the roll gets an owner invite, and the outgoing owner steps down only when it is claimed.

- Privacy is enforced in the database: the hub calls `admin_*` functions that refuse anyone whose confirmed email isn't in `platform_admins`. That table can't be read or changed from the site; add another owner in the SQL editor.
- The hub can change a lodge's plan and no-charge flag, add a lodge with its owner's invite (the page at `lodges/<slug>.html` is still added in the repo), and create or end plan codes.
- The Stripe key is write-only: it's kept in `platform_secrets` (row `stripe_secret_key`), which only the service role can read; the hub sees just test/live and the last four characters. Server code should use Vercel's `STRIPE_SECRET_KEY` when it's set and this row otherwise.
- Revenue figures are at list price from the plans until Stripe billing is live.
- Master dashboard: search, a Needs attention list (lodges with no owner, unpaid bills, unconfirmed or blocked accounts), and Manage on each lodge to edit its details, change roles, remove brethren, invite and cancel invites. Accounts can be confirmed, sent a password reset, blocked and unblocked, or deleted. Deleting an account or lodge asks for its email or page address typed back, and the database checks it again. A lodge with a running Stripe subscription can't be deleted until it's cancelled in Stripe, and the owner's own account and other platform owners can't be blocked or deleted from the site.

## Deploy

The site is static, so Vercel serves it with no build step. Import this repo in Vercel (Add New → Project), keep the framework preset at "Other", and deploy. Every push to `main` redeploys. `vercel.json` turns on clean URLs, so pages are served at `/features`, `/demo` and `/pricing`.

## Run locally

Run `npx serve .` from the repo root (it also serves clean URLs). Opening the files directly won't resolve the `/assets/...` paths.

## Jarvis

`/jarvis` is LodgeNet's operations chief of staff: live Stripe revenue (balance, last 30 days, monthly recurring, open and overdue invoices), dev status from GitHub (open pull requests, latest deploys, recent commits), and a Claude-written briefing with today's priorities and sales and marketing moves. You can also ask it questions. It only reads: it can't move money, merge code or email anyone. It's not linked from the site and isn't indexed.

The page calls `api/jarvis.mjs`; the engine is `api/_jarvis-core.mjs`, an identical copy in every Joslin Enterprises repo, so change it there and copy it across. Set these in Vercel → Settings → Environment Variables, then redeploy:

- `JARVIS_ACCESS_CODE` (optional): leave it empty and Jarvis opens for anyone with the link; set it to require a passphrase.
- `ANTHROPIC_API_KEY`: Claude, for briefings and questions.
- `JARVIS_STRIPE_KEY`: a restricted Stripe key with Read on Balance, Charges, Subscriptions and Invoices. Without it, Jarvis reads with the same key as billing (`STRIPE_SECRET_KEY`, or the one saved in the owner's hub).
- `GITHUB_TOKEN`: a fine-grained token with read-only Contents, Pull requests and Deployments on this repo.
- `JARVIS_MODEL` (optional): default `claude-sonnet-5-5`.

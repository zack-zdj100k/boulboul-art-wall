# Boulboul Art Wall

E-commerce platform for an Algerian wall-art studio: catalogue of artworks and LED mirrors with
dimension-based pricing, Buy Now checkout, custom design requests with image upload, customer
accounts, reviews, and an admin back-office with CMS.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL ·
Prisma 7 · Zod · Motion · sharp · Vitest.

---

## Getting started

```bash
cp .env.example .env            # then fill DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL…
npm install                     # also runs `prisma generate`
npm run db:migrate              # apply migrations to DATABASE_URL
npm run db:seed                 # DEV ONLY — demo catalogue + admin account (see below)
npm run dev                     # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Vitest (needs `TEST_DATABASE_URL` pointing to a database whose name contains `test`) |
| `npm run db:migrate` / `db:deploy` | Prisma migrations (dev / production) |
| `npm run db:seed` | Development seed (refuses to run with `NODE_ENV=production`) |

Admin: sign in at `/account/login` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, then open `/admin`.
**Change that password before going live** (create a new admin and remove the seed one).

## Demo data — read before launch

The seed uses the real Boulboul product photos (`public/brand`) but **every price, frame, option and
order it creates is a placeholder**, flagged `isDemo` and shown with a « Démo » badge on the site.
Nothing else is invented: no reviews, founders, contact details, social links, certifications,
delivery fees or legal text. Sections without real content are simply hidden.

To go live: *Admin → Paramètres → Supprimer les données de démonstration*, or edit each item and
untick « Donnée de démonstration ».

What the business must fill in (Admin → Contenu / Paramètres):

- Real products, prices, frames, options (and their prices)
- Delivery rules per wilaya/commune — until then the customer sees « Livraison à confirmer »
- About page: story, founders (names, roles, photos, links)
- Why Boulboul: quality, materials, production, guarantees, pricing positioning, certifications
- Contact details, social links, terms & privacy policy
- Real customer reviews (moderation, or « Ajouter un avis réel » for feedback received elsewhere)

## Architecture

One Next.js app (deployed as one project on Vercel), with the code split by role:

```
prisma/
  schema/            database schema, one file per domain (00-config, 01-identity, 02-media,
                     03-catalog, 04-orders, 05-returns, 06-custom-orders, 07-reviews,
                     08-notifications, 09-site, 10-analytics)
  migrations/        SQL migrations (applied by `prisma migrate deploy` on every Vercel build)
  seed.ts, data/     development demo data, ZR Express delivery rates

src/
  app/               Next.js routes (must stay here)
    (site)/          public pages: home, /wall-art, /commande, /customize, /about, /account, /order
    admin/           back-office pages (ADMIN check in the layout + in every /api/admin route)
    api/             HTTP entry points of the backend (REST route handlers)
    media/           authorised file server (private customer designs → admin/uploader only)

  frontend/          what runs in the browser / renders the UI
    components/      ui (design system), site, home, shop, product, cart, forms, account, order, admin
    hooks/           React hooks
    lib/             browser-only helpers: basket (cart.ts), API client

  backend/           server only (never sent to the browser)
    services/        pricing, orders, returns, products & pricing tables, custom orders, reviews,
                     media, CMS, delivery, settings, users, stats, audit
    email/           notifications (new order → admin, confirmed / delivered → customer) + providers
    storage/         local disk, S3-compatible or Cloudinary
    auth/            password hashing, DB sessions, guards, order access, upload tokens
    generated/       Prisma Client (generated, not committed)
    db.ts, env.ts, http.ts …

  shared/            used by both sides
    lib/             pricing engine, validation (Zod), CMS schema, wilayas & communes, options
    i18n/            fr (default) / ar (RTL) dictionaries, server + client helpers

tests/               pricing, order flow & emails, auth, uploads, custom orders, admin, storage
```

### Business rules implemented

- **Server-side pricing only.** `computePrice()` (preset price → or area formula → frame per metre
  or fixed → extras → promotion → rounding). The browser shows server quotes; orders are re-priced
  on creation and any client-sent amount is ignored.
- **Order snapshots.** Each `OrderItem` stores name, image, dimensions, frame, extras, unit price
  and the full pricing breakdown, so later product edits never change past orders.
- **Order numbers** `BAW-YYYY-NNNNNN` from an atomic per-year counter (not the DB id). Guests reach
  their confirmation page with a private random token.
- **Status machine** `PENDING → CONFIRMED → SHIPPED → DELIVERED`, cancel from any non-final state,
  with history (who/when/note) and audit log.
- **Exactly two emails:** new order → `ADMIN_EMAIL`; `PENDING → CONFIRMED` → customer. No other
  transition sends anything. A failed send never rolls back the order: it is logged (`EmailLog`),
  shown on the admin order page with a « Renvoyer » button, and flagged on the dashboard.
- **Custom requests** store a private upload (re-encoded to strip EXIF/GPS), dimensions, frame,
  extras and description; no automatic email.
- **Reviews** are public only once approved; « Accueil » toggles home testimonials.
- **Accounts at checkout.** Every order belongs to an account. A visitor who is not signed in fills in
  the delivery details, then a password, age and « Comment avez-vous connu Boulboul ? »: the account is
  created with the order (and signed in). If the e-mail already has an account, the customer is asked to sign in.
- **Traffic analytics** (*Admin → Réseaux sociaux*): each browsing session records its source — `utm_*`
  campaign links, ad click ids (`fbclid`, `ttclid`, `gclid`), the referrer, or the Instagram / TikTok /
  Facebook in-app browser. Orders and new accounts are credited to the last non-direct source (30 days).
  The page shows visits, visitors, accounts, orders, conversion and delivered sales per network and per
  campaign, plus a tracked-link builder for bios, stories and sponsored posts. No IP address or personal
  data is stored (random first-party visitor id); admins and bots are not counted; visits older than
  13 months are purged.

### Security

scrypt password hashing · opaque session tokens (only SHA-256 stored) in `httpOnly`/`SameSite=Lax`
cookies · Origin check on every mutating API call (CSRF) · server-side role checks · Zod validation
on all inputs · Prisma (parameterised SQL) · uploads validated by magic bytes + full decode with
sharp, random server-side keys, 10 MB limit · private files never cached · in-memory rate limiting
on login, register, orders, uploads, quotes and reviews · security headers (`X-Frame-Options`,
`nosniff`, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`) · errors return stable codes,
never stack traces.

> The rate limiter is per process. If you run several instances, back `rateLimit()` with Redis or Postgres.

## Configuration

See `.env.example`. Key variables:

- `EMAIL_PROVIDER` — `smtp` (with `SMTP_*`), `resend` (with `EMAIL_PROVIDER_API_KEY`), or `log`
  (development: emails are written to `storage/emails/*.html`).
- `ADMIN_EMAIL`, `EMAIL_FROM` — default recipient / sender of the order notifications (recipients,
  sender name and customer emails are then managed in Admin → Paramètres → E-mails & notifications).
- `STORAGE_DRIVER` — `local` (`STORAGE_LOCAL_DIR`, development), `cloudinary` (`CLOUDINARY_URL`) or `s3`
  (`S3_ENDPOINT`, `S3_BUCKET`, keys, optional `S3_PUBLIC_URL`).
- `APP_URL` — canonical URL (SEO, sitemap, links in emails, allowed Origin).

## Deploying: GitHub → Vercel (site) + Render (PostgreSQL) + Cloudinary (images)

1. **Render** — create a PostgreSQL database. Copy its *External Database URL* and add
   `?sslmode=require` at the end: that is `DATABASE_URL`.
2. **Cloudinary** — Dashboard → copy the *API environment variable* (`cloudinary://…`): that is
   `CLOUDINARY_URL`. Product images are public on Cloudinary's CDN; designs uploaded by customers are
   stored as *authenticated* (private) assets and only shown to admins through `/media/…`.
3. **Vercel** — *Add New → Project* → import this GitHub repository (framework: Next.js). Add the
   environment variables below, then deploy. The `vercel-build` script runs
   `prisma generate`, `prisma migrate deploy` (creates/updates the tables on Render) and `next build`.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Render external URL + `?sslmode=require` |
| `APP_URL` | `https://<your-project>.vercel.app` (then your own domain) |
| `SESSION_SECRET` | a new random value: `openssl rand -hex 32` |
| `STORAGE_DRIVER` | `cloudinary` |
| `CLOUDINARY_URL` | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |
| `EMAIL_PROVIDER` | `resend` (+ `EMAIL_PROVIDER_API_KEY`) or `smtp` (+ `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) |
| `EMAIL_FROM` | `Boulboul Art Wall <commandes@your-domain>` |
| `ADMIN_EMAIL` | the inbox for "nouvelle commande" |

Do not use `EMAIL_PROVIDER=log` or `STORAGE_DRIVER=local` on Vercel: its disk is read-only.

4. **First admin** — the production database starts empty (the demo seed refuses to run in production).
   Create your account on the live site (*Créer un compte*), then promote it from your computer with the
   production database URL:

   ```bash
   DATABASE_URL="<render external url>?sslmode=require" npm run make-admin -- you@example.com
   ```

5. **Delivery prices** — load the ZR Express rates into production the same way:

   ```bash
   DATABASE_URL="<render external url>?sslmode=require" npm run import-delivery-rates
   ```

6. In the admin: fill the CMS pages, create categories and products (images go to Cloudinary), set the
   prices (Tarification) and the notification e-mails (Paramètres).

## Notes & known limits

- The admin interface is French only (internal tool); the public site is French and Arabic (RTL).
- Wilayas: the 58 wilayas used by the carriers (`src/shared/lib/algeria.ts`); communes come from the official
  list (`src/shared/lib/algeria-communes.json`, geoalgeria — MIT), 2026 wilayas listed under their former wilaya.
- Prices are integer dinars (DZD). Payment happens offline; Boulboul confirms each order.
- Design references (DestinationCard, Footer-01, Team-01, Testimonials Columns, v-form-8, the scroll
  frame-sequence hero and the photo-sphere gallery) were re-interpreted as one Boulboul design system;
  no demo content, brands or images from them are used.

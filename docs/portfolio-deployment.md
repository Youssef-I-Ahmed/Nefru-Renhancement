# NEFRU Portfolio Deployment & Operations

## Hosted topology

```text
Browser
  ↓
Vercel — React/Vite frontend
  ↓ HTTPS credentialed API calls
Railway — Express API
  ↓
MongoDB Atlas

Railway domain worker
  ↓
durable outbox / notifications / scheduled domain jobs
```

Current portfolio endpoints:

- Frontend: `https://nefru-renhancement.vercel.app`
- API: `https://nefru-renhancement-production.up.railway.app`
- Health: `https://nefru-renhancement-production.up.railway.app/api/health`
- Readiness: `https://nefru-renhancement-production.up.railway.app/api/ready`

## Vercel

Project root:

```text
frontend
```

Build command:

```bash
npm ci
npm run build
```

Output directory:

```text
dist
```

Public environment:

```dotenv
VITE_API_BASE_URL=https://nefru-renhancement-production.up.railway.app/api
VITE_GOOGLE_CLIENT_ID=
VITE_DEV_AUTH_BYPASS=false
```

SPA rewrites must return application URLs to `index.html`.

## Railway API

Project root:

```text
backend
```

Start command:

```bash
npm start
```

Minimum production configuration:

```dotenv
NODE_ENV=production
MONGODB_URI=
JWT_SECRET=
FRONTEND_URL=https://nefru-renhancement.vercel.app
BACKEND_PUBLIC_URL=https://nefru-renhancement-production.up.railway.app
COOKIE_SAME_SITE=none
DEV_AUTH_BYPASS=false
```

Configure enabled integrations privately:

- Cloudinary
- Paymob Sandbox
- Resend
- Google OAuth, if enabled
- payment-token encryption key, if saved payment methods are enabled

Never place private provider secrets in the frontend environment.

## Railway domain worker

Deploy a separate Railway service from the same backend codebase.

Command:

```bash
npm run worker:domain
```

The API and worker must use the same database and compatible domain/provider configuration.

The worker processes durable domain jobs such as queued notifications and delayed review invitations.

## Paymob Sandbox

The portfolio deployment is for Sandbox/test payments only.

Relevant server-side variables:

```dotenv
PAYMOB_SECRET_KEY=
PAYMOB_PUBLIC_KEY=
PAYMOB_HMAC_SECRET=
PAYMOB_API_KEY=
PAYMOB_INTEGRATION_IDS=
PAYMOB_CURRENCY=EGP
PAYMOB_WEBHOOK_URL=https://nefru-renhancement-production.up.railway.app/api/payments/paymob/webhook
```

Provider callbacks and inquiry/reconciliation are treated as payment source-of-truth signals.

Refund initiation is restricted to bookings that entered cancellation/refund-review workflow. Refund transaction callbacks are handled idempotently.

## Cloudinary

Public experience/profile media can use Cloudinary.

Configure either `CLOUDINARY_URL` or the explicit cloud-name/key/secret fields. Do not expose the API secret to frontend/Vite code.

Guide identity/verification documents remain private authenticated resources. A real public production launch should use durable private storage for those files.

## Resend

Transactional email uses Resend when `RESEND_API_KEY` is configured.

Example:

```dotenv
RESEND_API_KEY=
MAILER_FROM=Nefru <verified-sender@your-domain>
```

Use a verified sender/domain in hosted environments.

## MongoDB Atlas

The portfolio database is:

```text
nefru_portfolio_demo
```

Do not import real customer databases into it.

The demo seed uses deterministic fictional fixtures and explicit target guards.

## Demo seed

From repository root:

```bash
npm run seed:demo -- --dry-run
npm run seed:demo -- --apply
```

With a dedicated environment file:

```bash
node --env-file=backend/.env.demo backend/src/scripts/seed.demo.js --dry-run
node --env-file=backend/.env.demo backend/src/scripts/seed.demo.js --apply
```

Always inspect dry-run output before apply.

## Release validation

Before merging a release to `main`:

```bash
npm run check
```

Then perform the hosted checks in [FINAL_DEMO_QA.md](FINAL_DEMO_QA.md).

## Secret hygiene

- `.env` files are ignored.
- Example env files contain no usable credentials.
- Rotate any credential that was ever exposed publicly.
- Removing a value from current source does not remove it from old Git history/provider logs.
- Never place real credentials in documentation or screenshots.

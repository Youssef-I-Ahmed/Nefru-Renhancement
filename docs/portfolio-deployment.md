# NEFRU portfolio preparation

This implementation prepares configuration, business workflows and a clean demo seed. It does **not** deploy,
create an Atlas cluster, alter the local MongoDB service, or run a seed automatically.
The original local databases and backups remain separate from the portfolio.

## Atlas setup (manual)

1. Create an Atlas project/cluster in your account. Choose a region appropriate for
   the eventual backend host and review the tier's limits and backup facilities.
2. Create the database **`nefru_portfolio_demo`**. Do not import local databases.
3. Create a database user scoped to this database (including the collection/index
   creation permissions required for the initial seed). Avoid cluster-wide admin access.
4. Add only the required developer/backend network addresses to Network Access.
5. Copy the Atlas driver URI, URL-encode password characters, and explicitly use
   `/nefru_portfolio_demo`. Set `DEMO_ATLAS_HOST` to the exact hostname in that URI.

Official references: [Atlas connections](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/)
and [IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/).

Never import real accounts, existing bookings/payment records, saved cards/tokens,
identity documents, old notifications or the local test databases.

## Environment variables

For the first local-backend/Atlas integration use `backend/.env.demo.example`.
It contains all runtime and seed variables, with local HTTP origins and auth bypass
disabled. Copy it to the ignored `.env.demo` only when ready to configure Atlas;
leave the existing local `.env` unchanged. Populate secrets privately, not in chat.

Use `backend/.env.example` and `frontend/.env.example` as variable inventories.
Do not overwrite an existing local `.env`. Use an ignored `backend/.env.demo`
for the seed, or supply variables through the shell/host secret settings.
Node 24 is suitable for the currently installed frontend toolchain; check the
lockfile's engine constraints when choosing the hosted runtime.

Backend runtime:

- `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
- `NODE_ENV=production` on the public backend, with `DEV_AUTH_BYPASS=false`.
- `FRONTEND_URL` and `BACKEND_PUBLIC_URL`: explicit HTTPS URLs when hosted.
- `COOKIE_SAME_SITE`: test with the actual hosting topology. Cross-site cookies
  use `none` with Secure; a same-origin API proxy can use `lax`. A `/api` proxy is
  a deployment prerequisite if configuring the frontend with a relative API URL.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
  `CLOUDINARY_FOLDER`. Alternatively keep all three credential fields empty and
  use the existing `CLOUDINARY_URL` configuration. Explicit fields take priority.
- Paymob: `PAYMOB_BASE_URL`, `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`,
  `PAYMOB_HMAC_SECRET`, `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_IDS`,
  `PAYMOB_CURRENCY=EGP`, `PAYMOB_CHECKOUT_MODE`,
  `PAYMOB_CHECKOUT_EXPIRATION_SECONDS`, `PAYMOB_WEBHOOK_URL`.
- Saved-card functionality requires `PAYMENT_TOKEN_ENCRYPTION_KEY`. Do not rotate
  an existing encryption key without understanding its existing token dependencies.
- `MAILER_HOST`, `MAILER_PORT`, `MAILER_EMAIL`, `MAILER_PASSWORD`.
- `GOOGLE_CLIENT_ID` if Google sign-in is enabled; optional `FX_*` display settings.

Credential fallbacks have been removed. Supply the values needed by enabled
integrations explicitly. No existing `.env` or provider key is changed by this work.
Examples contain no usable passwords. Removing a secret from source does not
revoke it or erase Git history; assess exposed credentials separately before publishing.

Frontend public settings only:

```dotenv
VITE_API_BASE_URL=https://<backend-host>/api
VITE_GOOGLE_CLIENT_ID=
VITE_DEV_AUTH_BYPASS=false
```

Never put database credentials, Cloudinary secrets or Paymob private keys in Vite
variables. They are public build inputs. Production must not rely on localhost fallbacks.

## Prepare demo media and credentials

Supply these seed-only variables in `backend/.env.demo` or the process environment:

```dotenv
MONGODB_URI=mongodb+srv://<user>:<encoded-password>@<cluster-host>/nefru_portfolio_demo?retryWrites=true&w=majority
DEMO_ATLAS_HOST=<cluster-host>
DEMO_ADMIN_EMAIL=<private-admin-email>
DEMO_ADMIN_PASSWORD=
DEMO_TOURIST_PASSWORD=
DEMO_GUIDE_PASSWORD=
DEMO_MEDIA_BASE_URL=https://res.cloudinary.com/<cloud-name>/image/upload/nefru-portfolio
```

Supply passwords with at least 12 characters and no more than 72 UTF-8 bytes.
The admin password must differ from the tourist/guide passwords. No password or
Atlas URI is printed by the seed. Do not publish Admin credentials.

Upload approved public demo images named `cairo.jpg`, `giza.jpg`, `luxor.jpg`,
`aswan.jpg`, `alexandria.jpg` and `siwa.jpg` under that media directory. The seed
does not upload assets or verify remote image availability; check all six URLs
before opening the demo. No avatars, IDs, licenses or passports are fabricated.

## Run the seed

From the repository root (Node 24), preview without connecting:

```powershell
npm run seed:demo --prefix backend -- --help
```

Run a **read-only Atlas dry-run** with a separate environment file:

```powershell
node --env-file=backend/.env.demo backend/src/scripts/seed.demo.js --dry-run
```

Then explicitly apply the inspected plan:

```powershell
node --env-file=backend/.env.demo backend/src/scripts/seed.demo.js --apply
```

If variables are already supplied in the process environment:

```powershell
npm run seed:demo --prefix backend -- --dry-run
npm run seed:demo --prefix backend -- --apply
```

Without an action flag, the seed defaults to dry-run. Dry-run still needs valid
fixture credentials/media settings and Atlas read access; it makes no database
writes, including automatic collection/index creation.

Safety guarantees:

- Only an Atlas `mongodb+srv` URI with the exact database and approved host is
  accepted. Wrong names, localhost, unsupported URI options and missing settings
  are rejected before connecting. The actual connected database is checked again.
- Deterministic IDs; collision checks precede writes. No database/collection deletion.
- Apply creates the existing schemas' indexes, then uses insert-only upserts.
  It does not replace existing passwords, schedules, edited content or visitor data.
- Model validation happens before connection; password hashes are produced
  explicitly because query upserts do not invoke the User pre-save hook.
- The operation is resumable, **not a single transaction**. If an error interrupts
  apply, rerun after resolving it; previously inserted fixtures are preserved.
- Never run `seed.js`, `OLDseed.js`, `migrate:egp`, or a reset against the demo
  database as part of this workflow. No seed runs on startup or deployment.

## Demo content and account usage

Initial seed: 10 users (3 tourists, 6 guides, 1 admin), 3 tourist profiles,
6 guide profiles, 10 experiences, 10 historical booking fixtures and 10 reviews.
Destinations are Cairo, Giza, Luxor, Aswan, Alexandria and Siwa. They are fixture
metadata, not a new collection; the existing frontend destination configuration
is unchanged in this phase.

- Tourists: `tourist1@demo.example.com` through `tourist3@demo.example.com`.
- Guides: `guide.cairo@demo.example.com`, `guide.giza@demo.example.com`,
  `guide.luxor@demo.example.com`, `guide.aswan@demo.example.com`,
  `guide.alexandria@demo.example.com`, `guide.siwa@demo.example.com`.
- Admin: the supplied `DEMO_ADMIN_EMAIL`.

These are fictional accounts. Their email-verification state and guide approval
are simulation fixtures for existing auth/eligibility checks, not real verification.
Guide names/descriptions explicitly identify them as demo profiles. Guide identity badges represent simulated eligibility for these fixtures. A global portfolio banner labels fictional content and prohibits real identity/payment details.

Each review has `isVerifiedBooking=false` and explicit fictional-demo text. Its
required Booking is a synthetic `completed`, **unpaid** fixture with
`bookingSource=seed`, `paymentProvider=none`, zero guide earnings, no provider IDs
and no BookingSeat. This represents demonstration history, not an actual charge
or attendance claim. No PaymentMethod, GuideVerification, Notification or
Interaction records are seeded. Demo/legacy reviews do not contribute to verified public ratings.

New trips receive five dates over the following 28 days in Africa/Cairo with
integer capacities and stable slot IDs. Rerunning preserves existing schedules;
it does not refresh old trips into new dates or rewrite booked occurrences.
Once these dates age out, schedule maintenance must be handled explicitly through
an approved workflow. Changing seed ENV passwords does not reset existing accounts.

Do not hand shared write-capable guide/admin credentials to unrestricted visitors.
Public visitors must use tourist accounts; keep shared guide/admin credentials private.
New verified reviews require payment, completed occurrence and checked-in attendance,
then moderation. See [marketplace implementation](marketplace-implementation.md) for
state transitions, migration, worker operations and external validation boundaries.

## Deployment notes and acceptance checks

- No deployment or Atlas creation is performed by these changes.
- Vercel: build frontend with `npm run build`; output is `dist`. Prepare API
  routing and SPA refresh rewrites in the deployment phase. See
  [Vercel's Vite deployment documentation](https://vercel.com/docs/frameworks/frontend/vite).
- Backend: `npm start`; configure HTTPS origins, cookies and persistent service
  behavior. `/api/health` currently checks liveness, not ongoing database readiness.
- Both packages still have a `file:..` dependency; resolve installation context
  before isolated cloud builds. Existing Hugging Face CI is unchanged.
- Private verification uploads remain on local filesystem; no identity documents
  are migrated. Storage and public-demo access policy remain launch blockers.
- Paymob uses existing server-side HMAC/inquiry/reconciliation. Set matching
  Sandbox keys/integration IDs and a reachable webhook. No payment logic or keys
  are changed, and this phase does not add a server-side sandbox-only guard.
- Test real login/logout, cookies, one-seat booking, Sandbox success/failure and
  callbacks, Cloudinary uploads, and per-user notifications on the hosted preview.
- Address known public serialization/destructive-admin-action risks separately
  before making the preview generally accessible.

Offline seed safety tests (no database connection):

```powershell
node --test backend/src/scripts/demo/seed.demo.test.js
```

## Phase 1.2: first Atlas integration (planned, not executed)

Create the cluster manually. A Free cluster is a reasonable starting point for
these fixtures if available in the chosen region. Prefer the backend's eventual
provider/region; provisional recommendation: AWS Frankfurt (`eu-central-1`) if
offered for the selected tier. Do not load Atlas sample datasets. Create a SCRAM
database user with `readWrite` on `nefru_portfolio_demo` only and restrict it to the
demo cluster. Add the current developer public IP to Network Access; later add
the backend's outbound addresses. The database can be materialized by the first
approved seed write; no dummy collection or local-data import is needed.

References: [cluster creation](https://www.mongodb.com/docs/atlas/tutorial/create-new-cluster/),
[database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/),
[AWS regions](https://www.mongodb.com/docs/atlas/reference/amazon-aws/).

Before any execution, verify the resolved URI's hostname/database without printing
its credentials. Node process environment variables override `--env-file` values;
an old shell `MONGODB_URI` must not override `.env.demo`. The ordinary backend
connection does not have the seed's exact database-name guard. Explicit empty
settings in the template also prevent dotenv from filling those keys from the
legacy local `.env`; do not omit them when preparing the new file.

Commands below are for later approval, from the **backend** directory, with Node 24:

```powershell
# Explicit environment-file loading (recommended).
node --env-file=.env.demo src/scripts/seed.demo.js --dry-run
# Inspect the dry-run first. Only then:
node --env-file=.env.demo src/scripts/seed.demo.js --apply
# Repeat dry-run: expected insert=0 and preserve=49 on a clean seeded database.
node --env-file=.env.demo src/scripts/seed.demo.js --dry-run
```

The package commands requested for the same operations are:

```powershell
npm run seed:demo -- --dry-run
npm run seed:demo -- --apply
```

Use those npm commands only when the demo variables are already loaded into the
process environment. They otherwise read the default `.env`, not `.env.demo`.
Do not replace `.env` to make the npm commands work.

Keep the backend stopped until seed counts/indexes have been checked. Expected
initial counts: User 10, TouristProfile 3, GuideProfile 6, Trip 10, Booking 10,
Review 10. No notifications, cards, payment transactions or verification documents
are seeded. Apply explicitly creates indexes for those six models and is resumable,
not atomic. Verify `getIndexes()` against schema definitions, especially unique
User email/profile user/Review booking constraints, and inspect deterministic IDs
and references. A failed apply requires inspection and rerun, never a database reset.

After seed verification, later start the local API explicitly with the demo ENV:

```powershell
node --env-file=.env.demo src/server.js
```

Integration checklist (pending real Atlas credentials and connectivity):

- Connect to the approved Atlas host/database; confirm no local DB connection.
- Verify the six seeded collections, 49 documents, indexes and relationships.
- Confirm all ten demo reviews are unverified and bookings have provider `none`.
- Re-run inspection and verify no duplicate fixtures or replaced passwords/dates.
- Start backend; verify `/api/health` plus a real DB-backed request (health alone
  is liveness only). Startup imports may create a private-upload directory locally.
- Test `POST /api/auth/login`, `GET /api/users/me`, `GET /api/users/profile/me`
  for tourist/guide accounts; test admin login and role access separately.
- Test cookies across browser refresh, incorrect passwords, unauthenticated access,
  and `POST /api/auth/logout`. Keep frontend at `http://localhost:5173` and API
  base URL `http://localhost:5000/api` for this local integration.
- Verify `GET /api/trips`, a seeded trip detail and the guide's trip list. Check
  future dates, EGP prices, photos and absence of false Verified booking badges.
- Check `/api/notifications` returns an empty list initially for demo users;
  start the persistent domain worker to deliver new transactional notifications.
- Observe FX refresh success or safe EGP-only fallback; cache writes after server
  startup are expected and should not be confused with extra seed documents.

Hosted-runtime findings after marketplace implementation:

- `src/config/db.js` awaits connection, replica-set readiness and declared indexes
  before serving traffic. Legacy seat TTL indexes require the guarded migration.
- Startup's FX timers live in each process; multi-instance/sleeping hosts need
  separate scheduling decisions. Provider failure leaves EGP available.
- `src/config/cloudinary.js` rejects partial explicit credentials at import time;
  missing all credentials allows startup but uploads fail. No remote credential
  validity check is performed by module initialization.
- `src/config/verificationUpload.js` creates a filesystem directory at import
  time. Read-only hosts can fail before DB connection; ephemeral storage is not
  durable for uploaded identity files.
- `src/app.js` uses one configured CORS origin and credentialed cookies. Production
  HTTPS origins and cross-site cookie behavior need hosted testing later.
- Transactional notification/email intents use a durable outbox and leased worker.
  SMTP delivery remains at-least-once and needs provider integration testing.
- DB startup errors and production API errors are sanitized; review hosting logs
  and vendor error handling as part of external acceptance.
- Paymob Sandbox callbacks cannot reach localhost directly. SMTP and Cloudinary
  need valid dedicated credentials; blank placeholders intentionally do not work.

## Marketplace startup after seeding

New and existing demo databases need persistent occurrence identities. Review and
run the guarded `migrateMarketplace.js` dry-run/apply commands described in
[the migration guide](marketplace-implementation.md#safe-migration-procedure--prepared-not-executed).
Do not run the old seed or copy local data. No migration was executed in this work.

From backend, with the private `.env.demo` supplied:

```powershell
node --env-file=.env.demo src/server.js
# In a separate terminal/process:
node --env-file=.env.demo src/scripts/domain.worker.js
```

The runtime refuses standalone MongoDB and a legacy seat TTL index. It never changes
MongoDB service configuration. New indexes are created before traffic is accepted.
`/api/health` is liveness; `/api/ready` checks database connectivity.

For hosting, use Node 24, `npm ci`, `npm start` for the API and `npm run worker:domain`
for its worker. Supply the same private runtime settings to both processes.
The frontend uses `npm ci`, `npm run build`, output `dist`, project root `frontend`.
Its Vercel rewrite handles SPA refreshes; configure an absolute HTTPS API URL.
No hosting resources have been provisioned or deployed.

Additional backend policy settings are documented in both ENV templates:
`PLATFORM_COMMISSION_BPS=0`, `TOURIST_REFUND_HOURS=24`, `DISPUTE_WINDOW_HOURS=24`,
`OCCURRENCE_EARLY_MINUTES=30`, `OCCURRENCE_LATE_MINUTES=60`,
`AUTO_COMPLETE_GRACE_HOURS=2`. `PRIVATE_UPLOAD_DIR` must refer to private persistent
storage if guide-document uploads are enabled. It must never be a public static path.

External acceptance checks must use actual Atlas, Cloudinary, SMTP and Paymob sandbox
credentials. Isolated tests exercise application logic, not those vendor integrations.

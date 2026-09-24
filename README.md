# NEFRU — Egypt Travel Experiences Marketplace

NEFRU is a full-stack MERN marketplace for discovering and booking curated travel experiences in Egypt with verified local guides.

It is built as a production-style portfolio project with separate Tourist, Guide, and Admin workflows, role-based authorization, operational state machines, background jobs, moderation, reviews, notifications, and Paymob Sandbox payment/refund handling.

> **Portfolio demo:** experiences and seeded accounts are fictional. Do not upload real identity documents or use real payment details.

## Live demo

- **Frontend:** https://nefru-renhancement.vercel.app/
- **Backend API:** https://nefru-renhancement-production.up.railway.app/
- **API health:** https://nefru-renhancement-production.up.railway.app/api/health

## Product roles

### Tourist

- Browse public experiences and destinations.
- Search/filter trips and use the nearby map.
- Save experiences.
- Book available occurrences.
- Pay through Paymob Sandbox.
- Track bookings, cancellations, and refund state.
- Receive notifications.
- Review eligible completed experiences.

### Guide

- Apply and submit verification documents.
- Create/edit experiences, schedules, and media.
- Submit experiences for Admin moderation.
- Manage bookings, attendance, and live operations.
- View recorded earnings.
- View published reviews and post public guide replies.
- Receive booking, payment, review, and account notifications.

### Admin

- Marketplace overview and analytics.
- Account and guide-verification review.
- Tour moderation and publication control.
- Booking and Paymob operations.
- Trust & Safety review/case workflows.
- Refund lifecycle handling and operational exceptions.

## Main workflows

```text
Guide application
→ verification review
→ guide approval
→ experience creation
→ admin moderation
→ publication
→ tourist booking
→ Paymob payment
→ occurrence / attendance
→ completion
→ review moderation
→ published review
→ guide reply
```

Cancellation/refund handling:

```text
paid booking
→ cancellation / refund entitlement
→ refund review
→ admin Paymob refund
→ provider reconciliation/webhook
→ booking + payment update
→ unsettled earnings adjustment
→ notifications
```

## Tech stack

### Frontend

- React 19
- React Router 7
- Redux Toolkit
- Vite 8
- CSS Modules
- Tailwind CSS utilities
- React Leaflet / OpenStreetMap
- Lucide icons

### Backend

- Node.js
- Express
- MongoDB Atlas
- Mongoose
- JWT + HTTP-only cookie authentication
- MongoDB transactions for domain workflows
- Durable outbox/domain worker

### External services

- **Paymob Sandbox** — hosted checkout, callbacks, reconciliation, refunds
- **Cloudinary** — public experience/profile media
- **Resend** — transactional email
- **Vercel** — frontend hosting
- **Railway** — API + domain worker
- **MongoDB Atlas** — hosted database

## Repository structure

```text
frontend/
  src/
    pages/
      Auth/
      User/
      Guide/
      Admin/
    routes/
    services/
    shared/
    store/

backend/
  src/
    controllers/
    models/
    routes/
    services/
    middlewares/
    scripts/
    tests/

docs/
  postman/
  FINAL_DEMO_QA.md
  portfolio-deployment.md
```

The backend separates HTTP handling from domain/service logic. Marketplace workflows use persisted booking/occurrence state, audit events, operational cases, and queued notifications rather than frontend-only simulation.

## Local setup

Requirements:

- Node.js 24
- npm
- MongoDB local replica set or approved Atlas database for transaction-backed workflows

Install from the repository root:

```bash
npm run install-all
```

Create local environment files from the safe templates:

```text
backend/.env.example  → backend/.env
frontend/.env.example → frontend/.env
```

Never commit populated `.env` files.

Run frontend and backend together:

```bash
npm run dev
```

Or separately:

```bash
npm run backend
npm run frontend
```

Run the domain worker in another terminal when testing queued domain jobs:

```bash
npm run worker:domain
```

## Validation

From the repository root:

```bash
npm run lint
npm run build
npm test
```

Or run all three:

```bash
npm run check
```

The frontend uses route-level code splitting. Heavy screens such as the map, Admin workspaces, and Guide operations are deferred until visited.

## Demo seed

NEFRU includes a guarded seed for fictional portfolio data.

Dry-run:

```bash
npm run seed:demo -- --dry-run
```

Apply only after reviewing the target database and environment:

```bash
npm run seed:demo -- --apply
```

The seed is designed for the dedicated `nefru_portfolio_demo` database and must not be used to copy real customer/payment/identity data.

See [docs/portfolio-deployment.md](docs/portfolio-deployment.md).

## API documentation

Postman assets are under:

```text
docs/postman/
```

See [docs/postman/README.md](docs/postman/README.md).

## Security / demo boundaries

- Secrets stay in environment/hosting configuration, never source control.
- Vite variables are public build-time values; never put private provider keys in `VITE_*`.
- Paymob is configured for Sandbox/test payments in the portfolio deployment.
- Guide verification files are private authenticated resources and must not be treated as public Cloudinary media.
- Demo accounts and experiences are fictional.
- Provider-side financial actions should be tested only with sandbox/test data.

## Current portfolio status

The portfolio version includes the Tourist marketplace, Guide portal, Admin portal, booking/payment flows, moderation, operational review cases, notifications, reviews/replies, Paymob refunds, responsive UI polish, and route-level bundle optimization.

Before presenting the hosted demo, run the final acceptance checklist:

[docs/FINAL_DEMO_QA.md](docs/FINAL_DEMO_QA.md)

# NEFRU Postman Documentation

Generated from the actual Express route mounts in `backend/src/routes/index.js`
and the route declarations in `backend/src/routes/*.routes.js`.

## Current generated coverage

- Folders: 11
- Requests: 103
- Collection schema: Postman Collection v2.1

## Files

- `collections/NEFRU.postman_collection.json`
- `environments/NEFRU Local.postman_environment.json`

## Regenerate

From the repository root:

```powershell
python docs/tools/generate_postman_collection.py
```

## Import into Postman

1. Import the collection.
2. Import the `NEFRU Local` environment.
3. Select the environment.
4. Start the backend.
5. Run **Authentication → Login** before protected flows.

Local API base URL:

```text
http://localhost:5000/api
```

## Authentication

The backend supports an HttpOnly authentication cookie and temporarily exposes
the JWT to API clients under `meta.token`. The Login test script captures that
token automatically into `{{token}}`.

Public requests explicitly use Postman's `noauth` mode so they do not inherit
the collection Bearer token.

## Important variables

- `base_url`
- `token`
- `tripId`
- `bookingId`
- `guideId`
- `occurrenceKey`
- `documentId`
- `methodId`
- `action`
- `page`

Additional path variables are generated automatically from Express `:params`.

## Suggested demo flow

```text
Register / Login
      ↓
Browse Trips
      ↓
Check Availability
      ↓
Create Booking
      ↓
Create Paymob Checkout
      ↓
Check Payment Status
      ↓
Tourist / Guide Booking Views
      ↓
Admin Booking Operations
```

## Safety

Do not put MongoDB credentials, JWT secrets, Cloudinary credentials, Paymob
keys, Gmail app passwords, or any other real secret in these tracked Postman
files.

Saved response examples are included only for selected endpoints whose response
shape is explicitly represented by the backend code used for this generator.

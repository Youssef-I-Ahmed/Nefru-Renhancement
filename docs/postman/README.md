# NEFRU API — Postman

The Postman assets in this directory document the NEFRU backend API.

## Modules

- Authentication
- Users / profiles
- Guides
- Trips
- Marketplace / occurrences
- Bookings
- Paymob payments
- Reviews
- Notifications
- Admin operations

## Base URLs

Local:

```text
http://localhost:5000/api
```

Hosted portfolio API:

```text
https://nefru-renhancement-production.up.railway.app/api
```

## Authentication

The browser app uses authenticated cookies. Some collection requests may also use an Authorization token depending on the endpoint/environment.

Do not save real passwords, JWTs, Paymob secrets, Cloudinary secrets, or private verification-document URLs in a committed Postman environment.

## Files

```text
collections/NEFRU.postman_collection.json
environments/NEFRU Local.postman_environment.json
```

When backend routes change, validate the collection against the actual route definitions before publishing generated API documentation.

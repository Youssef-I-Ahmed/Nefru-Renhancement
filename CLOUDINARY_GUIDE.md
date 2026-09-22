# NEFRU media — Cloudinary

New public image uploads use Cloudinary instead of the server filesystem.

## Environment

Copy `backend/.env.example` to `backend/.env` and set:

```env
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
CLOUDINARY_FOLDER=nefru
```

Keep `CLOUDINARY_URL` server-side only.

## Current migration scope

- Tourist profile avatar → Cloudinary
- Guide profile avatar uploaded through `/api/users/profile/avatar` → Cloudinary
- Tour cover photo → Cloudinary
- Tour gallery photos → Cloudinary
- Existing `/uploads/...` URLs remain readable during migration so old records do not break.
- Cloudinary `public_id` values are stored separately from delivery URLs so replaced assets can be deleted/invalidate correctly.

Guide verification documents are intentionally not moved into the public-image Cloudinary flow; they should remain handled by their dedicated protected verification-document storage path.

## Upload limits

- Images only
- Maximum 5 MB per image
- Tour upload: one cover + up to six gallery files per request

## Install/update dependencies

After applying the patch:

```bash
cd backend
npm install
```

This installs the Cloudinary Node SDK and refreshes `package-lock.json`.

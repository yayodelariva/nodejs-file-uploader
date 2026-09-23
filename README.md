# File Uploader

A small personal drive: sign up, upload files into nested folders, and hand out
share links that stop working when you say they should.

Built with Express 5, Prisma + PostgreSQL, Passport (local strategy) with
sessions persisted in the database, multer for uploads, and EJS views.

## Features

- **Session authentication** — email + password with bcrypt hashes, sessions
  stored in Postgres via `@quixo3/prisma-session-store`, so logins survive a
  restart.
- **Nested folders** — create, rename and delete folders inside folders.
  Deleting a folder removes everything beneath it, in the database *and* in
  storage.
- **Uploads** — multer buffers the file, validates it, then hands it to the
  configured storage driver.
- **File details** — name, size, MIME type, upload time and a download button.
- **Pluggable storage** — `local`, `supabase` or `cloudinary`, chosen with one
  environment variable. Cloud uploads store the returned URL on the file row.
- **Validation** — an extension/MIME allowlist plus a configurable size cap,
  both rejected with a readable message rather than a stack trace.
- **Expiring share links** — share a folder and everything under it with
  anyone, for a duration you pick (`30m`, `12h`, `7d`, `2w`).

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer

## Setup

```bash
npm install
cp .env.example .env     # then edit DATABASE_URL and SESSION_SECRET
createdb file_uploader
npx prisma migrate deploy
npm run dev              # or: npm start
```

The app is then on <http://localhost:3000>.

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Database URL

If your local Postgres uses peer authentication (no password over TCP), point
the URL at the unix socket:

```
DATABASE_URL="postgresql://YOUR_USER@localhost/file_uploader?schema=public&host=/var/run/postgresql"
```

## Storage backends

Set `STORAGE_PROVIDER` to one of:

| Value | Where files go | Extra settings |
| --- | --- | --- |
| `local` (default) | `LOCAL_UPLOAD_DIR`, outside the web root | — |
| `supabase` | A Supabase Storage bucket | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` |
| `cloudinary` | Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER` |

Each driver implements the same three methods (`save`, `remove`,
`getDownload`), so adding another backend means adding one file in
`src/storage/` and a line in `src/storage/index.js`.

Locally stored files are never served statically — downloads always go through
a route that checks ownership or a valid share first. Supabase downloads use a
60-second signed URL, so the bucket can stay private. Cloudinary downloads use
an `attachment` delivery URL.

## Upload validation

- **Size**: `MAX_UPLOAD_MB` (default 10) enforced by multer's own limit, so an
  oversized body is cut off rather than buffered in full.
- **Type**: the file's MIME type *and* its extension must both appear in the
  allowlist in `src/config/uploadRules.js` — images, PDFs, text/CSV/JSON,
  archives, Office documents, mp3 and mp4. Edit that file to change the policy.

## Sharing

From a folder, **Share** creates a link at `/share/<uuid>` valid for the
duration you enter. Anyone with the link can browse that folder and its
subfolders and download files, without an account. Expired or revoked links
return `410 Gone`, and the link only ever exposes the subtree it was made for.

## Project layout

```
prisma/schema.prisma     User, Folder, File, Share and Session models
src/config/              environment parsing and the upload allowlist
src/db/prisma.js         the single shared PrismaClient
src/auth/passport.js     local strategy, serialize/deserialize
src/middleware/          auth guards, multer wiring, error handlers
src/storage/             local / supabase / cloudinary drivers
src/services/            folder, file and share logic (all ownership-scoped)
src/routes/              auth, folders, files, public share routes
views/                   EJS templates
public/css/style.css     styles, light and dark
```

## Notes

- Every folder and file lookup is scoped by the owner's id, so an id belonging
  to another account comes back as a 404 rather than leaking its existence.
- Timestamp columns are `timestamptz`, so expiry maths agrees whether it is done
  in the app or in SQL.
- Forms are not CSRF-protected; the session cookie is `SameSite=Lax`,
  `HttpOnly`, and `Secure` in production, which covers cross-site POSTs from
  other origins. Add a token (e.g. `csurf`'s maintained forks) before running
  this anywhere that matters.
- `npm audit` reports advisories in `deepmerge-ts`, a transitive dependency of
  the Prisma CLI. It is a dev dependency and not reachable at runtime.

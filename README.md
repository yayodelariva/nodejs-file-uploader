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

New uploads go to whichever driver `STORAGE_PROVIDER` names, but every row
records the provider that stored its bytes, and reads and deletes follow that
column. Switching providers therefore only affects new uploads: files written
under the old backend keep downloading from it.

### Setting up Supabase

1. Create a project at <https://supabase.com/dashboard>. Only Storage is used;
   the database stays on your own Postgres.
2. Copy the project URL and a **service role** (or `sb_secret_...`) key from
   Project Settings -> API Keys into `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.
   Uploads happen server-side, so the anon/publishable key will not do.
3. Create the bucket named by `SUPABASE_BUCKET` (default `uploads`). Keep it
   **private** - downloads are signed per request, and a public bucket would let
   anyone holding an object URL bypass the ownership checks.
4. Set `STORAGE_PROVIDER=supabase` and restart.

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

## Deploying to Render

Render runs the app as an ordinary long-running Node process, so nothing about
the app has to change: `npm start`, the same environment variables, no request
size cap beyond `MAX_UPLOAD_MB`, and `SIGTERM` handled on redeploys.
`render.yaml` describes the service; create it with **New > Blueprint**, or fill
the same fields in by hand.

### 1. Database

Render cannot reach a Postgres on your laptop. Either add a Render Postgres
instance, or reuse the Supabase project that already holds the bucket -
Project Settings -> Database -> Connection string. Prefer the **session pooler**
string for both variables: Supabase's direct host resolves over IPv6, which not
every platform can route outbound.

- `DATABASE_URL`: session pooler connection
- `DIRECT_URL`: the same string (a persistent server holds one small pool, so
  there is no separate migration connection to keep apart)

### 2. Secrets

Set these in the dashboard - `render.yaml` marks them `sync: false`, so they are
never committed:

`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

The rest come from the blueprint: `NODE_ENV=production`, `STORAGE_PROVIDER=supabase`,
`SUPABASE_BUCKET`, `MAX_UPLOAD_MB`, and a generated `SESSION_SECRET`.

### 3. Deploy

Push the branch and point the blueprint at the repository. Each deploy runs
`npm ci && npx prisma migrate deploy` (with `postinstall` generating the Prisma
client), then `npm start`.

`NODE_ENV=production` turns on `trust proxy` and the `secure` cookie flag, both
of which the session needs behind Render's TLS terminator.

On the free plan the service sleeps after 15 minutes of inactivity, and the
next request pays a cold start of roughly a minute.

## Deploying to Vercel

Vercel runs the app as a serverless function: `api/index.js` exports the Express
app without calling `listen()`, and `vercel.json` rewrites every path to it.
`views/` and `public/` are pulled in through `includeFiles`, since template
paths cannot be traced statically.

Two constraints come with that runtime:

- **Request bodies are capped at 4.5 MB**, below the default `MAX_UPLOAD_MB`.
  Set `MAX_UPLOAD_MB=4` in the Vercel environment, or the app will accept a file
  that the platform has already rejected.
- **Local disk is not writable**, so `STORAGE_PROVIDER` must be `supabase` or
  `cloudinary` there. `local` only works on a host with a real filesystem.

### 1. A reachable database

The Postgres on your laptop is not routable from Vercel. Supabase provides one
with the project you already use for storage - Project Settings -> Database ->
Connection string:

- `DATABASE_URL`: the **pooled** connection (port 6543), with
  `?pgbouncer=true&connection_limit=1`. Functions open a connection per
  invocation, and the pooler is what keeps Postgres from running out.
- `DIRECT_URL`: the **direct** connection (port 5432), used only by migrations.

### 2. Apply migrations

Migrations run from your machine, not from the build - the build has no reason
to hold write access to the database:

```bash
DATABASE_URL="<direct connection>" npx prisma migrate deploy
```

### 3. Environment variables

Set these in the Vercel project (Settings -> Environment Variables):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase pooled connection string |
| `DIRECT_URL` | Supabase direct connection string |
| `SESSION_SECRET` | A fresh secret - not the development one |
| `NODE_ENV` | `production` |
| `STORAGE_PROVIDER` | `supabase` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` | As in `.env` |
| `MAX_UPLOAD_MB` | `4` |

`NODE_ENV=production` also turns on `trust proxy` and the `secure` cookie flag,
both of which the session needs behind Vercel's TLS terminator.

### 4. Deploy

```bash
npx vercel          # preview deployment
npx vercel --prod   # production
```

`postinstall` runs `prisma generate` on each build, and the schema generates the
`rhel-openssl-3.0.x` query engine that Vercel's Amazon Linux runtime needs
alongside the local one.

Render (above) needs none of this, which is why it is the primary target here.
`api/index.js` and `vercel.json` are inert on any other host.

## Project layout

```
api/index.js             serverless entry point (Vercel)
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
render.yaml              Render service definition
vercel.json              routes every path to the serverless entry point
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

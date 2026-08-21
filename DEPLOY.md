# Hosting the demo — free tier

A guide to putting **Ruwanpura Gems ERP demo** on the internet at no cost, so a
client can open a link and use it.

## What the app actually needs

It is not a static site. Three things have to be hosted:

| Need | Why |
|---|---|
| **Node server** | Server components, server actions and the API routes are the backend. `sharp` (image processing) needs the Node runtime, not an edge runtime |
| **PostgreSQL** | All the data |
| **Object storage** | Stone photographs. Serverless hosts have **no persistent filesystem**, so the local disk driver will not work there |

## Recommended: Vercel + Neon + Cloudflare R2

All three have genuinely free tiers, none needs a credit card to start, and the
combination has no cold-start penalty worth worrying about.

| Layer | Service | Free tier |
|---|---|---|
| App | **Vercel** Hobby | No spin-down, native Next.js, global CDN |
| Database | **Neon** | 0.5 GB storage; sleeps when idle and wakes in about a second |
| Photos | **Cloudflare R2** | 10 GB storage, 10M reads/month, **zero egress fees** |

<br>

> **One honest caveat.** Vercel's Hobby plan is licensed for **non-commercial
> use**. Showing a prospective client a demo sits in a grey area; the moment
> they are actually running their business on it, that is commercial and needs
> Vercel Pro (about USD 20/month) or a move to a VPS. Do not build the client's
> expectations on a free tier you cannot keep.

### What I ruled out, and why

- **Render free web services** spin down after 15 minutes of inactivity and take
  the better part of a minute to wake. Your client clicks the link mid-meeting
  and stares at a blank page. Unusable for a demo.
- **Supabase free** pauses a project after 7 days of inactivity and needs a
  manual restore. A demo that sits between client meetings is exactly that case.
  Its storage is fine; its database scheduling is the problem.
- **Cloudflare Workers** cannot run `sharp` (native binary).

---

## Step 1 — Database (Neon)

1. Sign up at **neon.tech**, create a project.
2. Pick the region closest to Sri Lanka — **Singapore (ap-southeast-1)** or
   **Mumbai**. This matters: a European region adds ~150 ms to every query.
3. Copy the **pooled** connection string (the host contains `-pooler`). Serverless
   functions open and close connections constantly and will exhaust a direct
   connection limit.

```
postgresql://user:password@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

Apply the schema and load the demo data from your own machine — not from the
build, so you can see what happens:

```bash
cd gem-stock
DATABASE_URL="<neon pooled url>" npx prisma migrate deploy
DATABASE_URL="<neon pooled url>" npx tsx prisma/seed.ts
```

## Step 2 — Photo storage (Cloudflare R2)

1. Sign up at **cloudflare.com**, open **R2 Object Storage**, create a bucket,
   e.g. `ruwanpura-gems-media`, in the **Asia-Pacific (APAC)** location. Leave it
   **private** and leave the Public Development URL **disabled** — the app serves
   images through its own authenticated route, so a photo URL is not a public
   window into the inventory. You do not need a CORS policy: uploads go through
   the server, not browser-to-R2.

2. Get an API token. It is **not** inside the bucket — go up to the R2 overview
   page, then **{ } API → Manage API tokens → Create API token**:

   | Field | Value |
   |---|---|
   | Name | `ruwanpura-erp` |
   | Permissions | **Object Read & Write** — not Admin; least privilege |
   | Buckets | Apply to specific buckets only → your bucket |
   | TTL | Forever |
   | Client IP filtering | Leave empty — Vercel's IPs are dynamic |

   The **Access Key ID** and **Secret Access Key** are shown once. Copy them then.

3. The endpoint is `https://<account-id>.r2.cloudflarestorage.com`.

<div class="box warn" markdown="1">
<span class="lbl">Two mistakes that cost an hour each</span>

**Do not include the bucket name in the endpoint.** The bucket page displays
`<account-id>.r2.cloudflarestorage.com/<bucket>`. The app passes the bucket
separately — the endpoint stops at `.com`.

**Copy the account ID with the button, do not read it off the screen.** It is 32
hex characters and the field truncates. A short ID produces a TLS or DNS failure
that looks nothing like a configuration problem.
</div>

Then check it before deploying:

```bash
MEDIA_DRIVER=s3 S3_BUCKET=... S3_ENDPOINT=... \
  S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
  npm run check:storage
```

It validates the settings, then does a real upload / download / delete against
the bucket, and names the likely cause when something fails.

## Step 3 — The app (Vercel)

1. Push this repository to GitHub.
2. On **vercel.com**, *Add New → Project*, import the repo. Vercel detects
   Next.js; leave the build settings alone.
3. In **Settings → Functions**, set the region to **Singapore (sin1)** or
   **Mumbai (bom1)**, matching your database.
4. Add the environment variables below, then deploy.

### Environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | The Neon **pooled** connection string |
| `SESSION_SECRET` | 32+ random characters — `openssl rand -base64 48` |
| `MEDIA_DRIVER` | `s3` — **required on Vercel**, there is no disk |
| `S3_BUCKET` | `ruwanpura-media` |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | From the R2 API token |
| `S3_SECRET_ACCESS_KEY` | From the R2 API token |
| `S3_REGION` | `auto` |

The app refuses to start without a valid `SESSION_SECRET`, which is deliberate —
a silently insecure deployment is worse than one that fails loudly.

---

## Gotchas worth knowing before they bite

**`MEDIA_DRIVER=s3` is not optional on Vercel.** With the local driver, uploads
appear to succeed and the files vanish on the next deployment, because the
filesystem is ephemeral.

**Request bodies are capped at 4.5 MB** on Vercel serverless functions. Phone
photographs are 8–12 MB. The uploader already shrinks images in the browser
before sending, so this is handled — but if you change that code, remember why
it exists.

**Migrations run from your machine, not the build.** Running
`prisma migrate deploy` inside a build works until two builds run at once. Run it
yourself, watch it succeed, then deploy.

**Neon sleeps when idle.** The first request after a quiet period takes about a
second longer. Harmless, but open the link a minute before a client call so the
first impression is a fast one.

**Never point this at real client data.** It is a public URL with demo
credentials printed on the login page. When the client's real stock goes in, it
moves to a private deployment with real accounts and the demo logins removed.

---

## Alternative: one small VPS (~USD 5/month)

If the free-tier caveats bother you — and for anything the client actually uses,
they should — a single VPS is the deployment the project plan assumes:

- **Hetzner CPX11** or similar, in a region near Sri Lanka
- Docker Compose: the app, Postgres, and Caddy for automatic HTTPS
- `MEDIA_DRIVER=local` with a mounted volume — no object storage needed
- Nightly `pg_dump` to R2 or Backblaze B2

No spin-down, no body-size limits, no licensing grey area, and it is closer to
what you would hand over. `compose.yml` in this repository already runs the
database this way.

## Before you send the link

- [ ] Sign in as all three accounts and confirm each sees what it should
- [ ] Upload a photograph and confirm it survives a redeploy *(proves R2 works)*
- [ ] Open a memo and print the voucher
- [ ] Print a sheet of packet labels and scan one with your phone
- [ ] Export a CSV and open it in Excel
- [ ] Load the site on your phone
- [ ] Open the link cold, from a different network, and time it

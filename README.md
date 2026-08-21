# Ruwanpura Gems ERP demo

Phase 1 of the gem trading system — see `../simple-3-month-plan/` for the plan
this implements.

Answers the four questions a gem business owner cannot currently answer quickly:
**what do I own · what did it really cost · where is it right now · am I making money.**

## Running it locally

Requires Node 22+ and Docker.

```bash
npm install
npm run db:up        # PostgreSQL 16 in Docker on port 55432
npm run db:deploy    # apply migrations
npm run db:seed      # 464 realistic Ceylon stones
npm run dev          # http://localhost:3000
```

### Restarting

There is no separate backend — the app and its API are one Next.js process.
Only the app (port 3000) and PostgreSQL in Docker (port 55432) run.

```bash
npm run dev:fresh    # regenerates the Prisma client, clears .next, restarts
```

Use this after **any** schema change. `Cannot read properties of undefined
(reading 'count')` on something like `db.job` means the running server loaded a
Prisma client generated before that model existed — `dev:fresh` fixes it.

**After `db:reset` or `db:seed`, sign out and sign in again.** Reseeding deletes
and recreates the users, so an open session points at a user id that no longer
exists. The app now detects this and sends you back to the login screen rather
than failing on the first write, but you still need a fresh login.

The database is a separate container and rarely needs restarting
(`npm run db:up` / `npm run db:down`). `npm run db:reset` drops it and reseeds —
destroys all local data, and Prisma will ask for confirmation.

Sign in with any of these — password `ruwanpura123`:

| Account | Role | Sees |
|---|---|---|
| `owner@ruwanpura.lk` | Owner | Everything, including cost and margin |
| `manager@ruwanpura.lk` | Manager | Operations and cost, not margin |
| `clerk@ruwanpura.lk` | Data Entry | **No cost or margin figures at all** |

Sign in as the clerk to see field-level permissions working — cost columns are
replaced with `••••` and the reports page is blocked.

## What is built

| Feature | Status |
|---|---|
| Login, sessions, three roles, field-level permissions | Done |
| Master data — variety, shape, colour, treatment, locations, people | Done |
| Stone registry — list, search, filter, paginate, detail | Done |
| Lot genealogy — parcel splits, cost allocation, yield | Done |
| Cost ledger — purchase + cutting + heating + lab rolled into landed cost | Done |
| Custody — who holds what, days out, overdue | Done |
| Add-stone form with "save & add another" | Done |
| Purchases register | Done |
| Jobs — send stones to a cutter/heater/lab, receive them back | Done |
| Automatic yield per stone, per job and per vendor | Done |
| **Sales with realised margin, per-carat or total pricing, multi-currency** | **Done** |
| **Photo upload — camera or file, auto-resized, EXIF stripped** | **Done** |
| **CSV export on every list, permission-scoped and audit-logged** | **Done** |
| **Print layouts for stock-take and custody sheets** | **Done** |
| **Date-range filters on sales and the flow reports** | **Done** |
| **Memo / consignment — issue, partial settle, extend, signed voucher** | **Done** |
| **QR packet labels — scan to open the stone's record** | **Done** |
| Reports — vendor performance, sales margin, stock, treatment mix, parcel yield | Done |
| Dark mode, collapsible sidebar, Ctrl+K command palette, toasts | Done |
| Certification workflow, partner shares, broker commission | Phase 2 |

## Hosting it

See **[DEPLOY.md](DEPLOY.md)** — free-tier deployment on Vercel + Neon +
Cloudflare R2, the caveats that matter, and the one-VPS alternative for when
the client actually uses it.

Photo storage has two drivers (`src/lib/storage.ts`): `local` writes to a
mounted volume and is what runs in development and on a VPS; `s3` targets any
S3-compatible bucket and is **required on serverless hosts**, which have no
persistent filesystem.

## Interface

Dense by design — rows-per-screen is a feature for anyone entering forty stones
from one parcel. The polish is in typography, contrast and motion rather than
whitespace.

- **Dark and light**, following the OS by default. Theme and sidebar state are
  applied by a pre-paint script on `<html>` and driven by CSS, so there is no
  flash of the wrong theme and no React state to hydrate.
- **Ctrl/Cmd-K** opens a command palette: jump to any page, or find a stone by
  number, certificate number or variety.
- **Collapsible sidebar** for small laptops.
- **Print** drops the navigation, forces light ink on white paper regardless of
  the screen theme, and repeats table headers across pages.

## Reports & export

Every list has a CSV download that carries **the page's current filters**, so
what downloads is what is on screen. Cost and margin columns are omitted for
roles that cannot see them, and every export is written to the audit log with
the actor and row count — a full stock register with costs is the most valuable
thing an insider can walk out with.

Period filters apply to **flow** reports — sales, jobs completed, parcels cut.
Stock on hand and holdings by treatment are **position** reports and stay
as-at-today, labelled as such: filtering a stock position by a date range would
silently produce a number that means nothing.

## Memo / consignment

Goods on approval — the part of the trade where stock quietly disappears.

- Issue a memo with a due date; the stones move to the party's custody but
  **stay owned by the business** and stay in the stock valuation.
- **Partial settlement is the default.** Every line starts as "still out"; a
  dealer returning four of six and keeping two is the normal shape of a memo.
- Marking a line **sold** creates a real sale record linked back to the memo, so
  margin and the sales register stay complete rather than the stone quietly
  changing status. Selling a stone already out on memo *with that buyer* is
  allowed; out with anyone else, it must come back first.
- **Extensions are appended, never overwritten** — a repeatedly-extended memo is
  visible for what it is.
- A printed voucher carries the ownership clause, weights, quoted prices and two
  signature lines.

## Packet labels

`/labels` prints QR labels sized for the paper packet a stone lives in, three
across on A4 with cut lines. Filters carry through from the stone list, so you
can label exactly the tray you just sorted.

The QR payload is the stone's own URL — any phone camera opens the record, with
no app to install and nothing to teach.

## Photographs

Upload from a phone camera or a file picker. Each image is resized to 1600 px
with a 320 px thumbnail, re-encoded as JPEG, and stripped of EXIF — phone
photos carry GPS coordinates, which on a gem business's images is a real
security problem. Files live outside the database (see `src/lib/storage.ts`),
which keeps backups small; the local driver is the one in use, and Cloudflare
R2 is an implementation of the same two-method interface.

Images are served through `/api/media/file/...` behind the session, so a stone's
photo URL is not a public window into the inventory.

## Architecture notes

Two schema patterns look like over-engineering and are not. Both are cheap now
and are rewrites later:

**Transformations as events**, not a `parentId`. A parcel splitting into forty
stones is one→many; a matched pair is many→one. A parent pointer cannot express
the second, and the trade needs both. Invariant, enforced in the service layer
and true across all seeded data:

```
sum(input weight) = sum(output weight) + loss
```

**Jobs are not transformations.** A cutting job returns *the same stone* at a
lower weight. Modelling that as a Transformation would put one stone on both
sides of the same event and make the ancestry recursion self-referential. The
job line records the weight change; Transformation stays for genuine one→many
splits and many→one merges.

**Sessions are re-checked against the database on every request.** The session
is a signed JWT, so it keeps asserting whatever it was issued with — including a
deleted user id or a role that has since been downgraded. `requireUser()`
re-reads the user, so deactivation takes effect immediately instead of at token
expiry, and a stale id redirects to login instead of throwing a foreign-key
error on the first write.

**Cost as a ledger**, not a `cost` column. Cost accrues from purchase,
allocation, cutting, heating and lab work. Landed cost is a `SUM`, and the same
query grouped by kind produces the breakdown that wins the demo.

Also fixed from day one: **money is `BigInt` minor units** with an explicit
currency (never float), **weights are `Decimal(12,3)`** (never float — a
rounding error in a stock reconciliation looks like theft), and the FX rate
used is stored alongside the converted amount rather than recomputed later.

## Stack

Next.js 16 · TypeScript · PostgreSQL 16 · Prisma 7 · Tailwind 4 · Zod ·
`jose` sessions · `bcryptjs`. One deployable, one database, no queue, no cache,
no staging cluster — deliberately boring, because it has to be maintained by
one person working part-time.

## Layout

```
prisma/schema.prisma     the model — read this first
prisma/seed.ts           realistic Ceylon data, deterministic
src/lib/queries/         all database access, returns plain serialisable objects
src/lib/services/jobs.ts issue and receive — the transactional business rules
src/lib/permissions.ts   the role matrix
src/app/(app)/           authenticated pages
src/components/          UI primitives and gem-specific display
```

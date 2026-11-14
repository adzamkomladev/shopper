# Day 41 plan · Data export + Shopper Archive

Branch `day41-archive-export` off `origin/main` (257d90a3, PR #59 merged). Data is disposable: local Postgres, the
Rivet volume, RustFS buckets, `.shopper/` and machine containers may be wiped whenever that is simpler. No subagents:
the planner, test-author, implementer, ui-builder and reviewer roles are done inline with their skills.

## Context

Notion row **41 · Data export + Shopper Archive** (Phase 7, P0, surfaces Migration + Portal, Ubuntu). Goal: **the owner's
data is always theirs, in a format that also powers migration.** Done when: **one click produces a complete, verifiable
copy of a business.** Tasks:

1. Per-entity exports (CSV + XLSX): products, prices, customers, sales, lines, tenders, stock, tax, audit
2. **Shopper Archive v1** (`.shopper`): `manifest.json` (schema version, org, counts, SHA-256 per file), NDJSON per
   table, blobs, Ed25519 signature
3. Streaming export: cloud via Workflow → R2 signed URL; box to disk/USB
4. Export screen; every export is an audited command
5. Versioning (added 30 Sep): `archive_format` and `product_version` in the manifest; the importer upcasts older
   archives and refuses newer ones with a clear message

Tests required by the row: an archive of the fixture org validates and one flipped byte is detected; CSV row counts
equal DB counts.

What the code has today (read, not assumed):

- `packages/export` is an empty stub (`index.ts` is one empty line, `layout.md` calls it "future").
- `packages/core/src/reports/export/files.ts` already turns a `ReportTable` into CSV (`reportCsv`) and a one-sheet
  workbook (`reportWorkbook`, SheetJS) with exact money/quantity/bps text. Every entity export reuses it; no new
  spreadsheet code.
- Ed25519 through WebCrypto exists in `packages/core/src/licence/keys.ts` (`generateKey`, `sign`, `verify`,
  base64url helpers). The signed update bundle (`rel/1`) is the precedent for "manifest with a SHA-256 per file,
  signed".
- The org's `session_key` is an **HMAC secret**, not a keypair, and must never leave the database, so it cannot sign an
  archive anyone else verifies.
- `Blobs` (`put/get/createUpload/createDownload/delete/signedUrl`) is identical on both adapters. `put` takes a whole
  `Uint8Array`, there is no multipart. A **port change would need `packages/conformance` on both adapters**, so this
  day does not change the port.
- Workflow kinds are implemented once in core (`runFiscalArchive`) and wired by a thin Cloudflare class
  (`packages/adapters/cf/src/workflows/fiscal.ts`, exported by `apps/edge/src/index.ts`, bound in
  `apps/edge/cloudflare.config.ts`) and a Rivet launcher (`packages/adapters/box/src/workflows/fiscal.ts`,
  started from `apps/box/src/app.ts`). The new workflow copies that shape.
- Permissions are code (`packages/auth/src/schemas/permissions.ts`, `roles/defaults.ts`), not seeded by hand.
- `fiscal_archive` + `archiveFiscalHour` is the precedent for "a command writes blobs + a tracking row in one
  transaction".
- Figma: the six links were given, but the Figma MCP View seat is **rate-limited** (same as Day 40, every call
  refused), so no frame could be read. The screen follows the shipped portal patterns (reports screens for the entity
  list, the Billing → Updates card for the archive list, `Alert`, `Field`, `Badge`). Said plainly in the verification
  file.

| Notion task                   | Slice | Expected work beyond the test                                                    |
| ----------------------------- | ----- | -------------------------------------------------------------------------------- |
| Archive format + seal/verify  | S1    | `@shopper/export`: stored-ZIP writer/reader, manifest schema, sign, verify       |
| Complete, consistent dump     | S2    | One REPEATABLE READ snapshot, every `org_id` table, credentials left out         |
| Streaming export via Workflow | S3    | `export_job` + `archive_key` tables, audited commands, workflow on both runtimes |
| Per-entity CSV + XLSX         | S4    | Nine entities as `ReportTable`s, streamed CSV, XLSX with a row cap, audited      |
| API + download                | S5    | `/export/*` routes, `export.run` permission, tenant sweep entries                |
| Export screen                 | S6    | `@shopper/backoffice` screen, e2e, `ui-verify` at five sizes                     |
| Box                           | S7    | Same workflow on Rivet; sealed-box drill exports and verifies                    |
| Docs, review, release         | S8    | Docs, Codex review, push, PR, CI, merge, Notion                                  |

## Decisions (defaults; say if you want otherwise)

1. **Container = a ZIP, stored (no compression), named `.shopper`.** The owner can `unzip` it with anything; no new
   dependency (a ~60-line writer and a ~40-line reader in `@shopper/export`, CRC-32 included). Limit named: no ZIP64,
   so one archive holds under 4 GB; the writer throws a clear error beyond it ("shortcut: 4 GB, upgrade to ZIP64
   when a business reaches it").
2. **Layout.**
   ```
   manifest.json              archive_format, product_version, schema_version, org{id,name,slug}, createdAt,
                              publicKey, tables{name:{rows, files:[{path,bytes,sha256,rows}]}}, blobs[{path,bytes,sha256}]
   manifest.sig               Ed25519 over the exact manifest.json bytes, base64url
   tables/<table>/0001.ndjson one JSON object per line, ≤ 5,000 rows per file (a table is its files in order)
   blobs/<key>                every blob the org's rows point at: assets, fiscal bundles, stored receipts
   ```
   A table is a folder of ordered chunks, not one file: each chunk is hashed once as it is written, so no step ever
   holds a table in memory and a retry rewrites only deterministic keys. Concatenating a folder gives the table.
3. **Which tables.** Discovery, not a hand-kept list: every table in `public` with an `org_id` column (including
   `org`) is exported as `to_jsonb(t) - <hidden columns>`. Left out entirely: sessions and session keys, device and
   enrolment credentials, enrolment attempts, verification tokens, the archive's own key and jobs. Left out by column:
   password and PIN hashes. **Archive v1 carries no credential material**: after a move, people reset their password or
   PIN and tills re-enrol (the Day 42 handshake owns tills). A coverage test fails when a new `org_id` table is neither
   exported nor on the exclusion list with a reason, and when an excluded name or column does not exist.
4. **Consistency.** One `REPEATABLE READ, READ ONLY` transaction reads every table, so the archive is a point-in-time
   snapshot while the shop keeps trading. It runs as **one Workflow step** (retries rewrite the same part keys);
   a second step seals. Rows are paged with `ctid` keyset (`WHERE ctid > $last ORDER BY ctid LIMIT 5000`), which works
   for tables with no `id` and is stable inside the snapshot. Rows stay as Postgres' own JSON text (`::text`), so
   bigints and money are never rounded through JavaScript numbers. Limit named: the step must finish within one
   Workflow step's budget, which is fine at pilot scale; a business too large for it needs per-table steps over an
   exported snapshot (the box backup already does that for `pg_dump`).
5. **Signature.** A per-org Ed25519 pair in a new `archive_key` table, created on the first export (private JWK +
   public key), never exported. The manifest carries the public key; `verifyArchive` checks every file's SHA-256 against
   the manifest and the signature against the manifest's key. It returns the key so the importer (Day 42) can compare
   it to a key it trusts. Same trust model as `session_key` (lives in the database so a restore keeps it); a key from
   inside the archive proves integrity, not who made it, and the screen shows its fingerprint.
6. **No R2 signed URL for the whole archive (deviation from the row).** The port has no multipart upload, so one object
   of several GB cannot be written without a port change (both adapters + conformance). Instead the 5,000-row parts and
   blobs stay in the org's Blobs and `GET /export/archives/:id/download` **streams the ZIP** assembled from them
   (constant memory, any size under 4 GB, same on cloud and box). The parts are already hashed, sized and CRC'd by the
   workflow, so the ZIP's sizes and headers are known before the first byte goes out. The signed-URL path is the first
   follow-up if a multipart port method is ever approved.
7. **Box: "to disk/USB".** The workflow runs on Rivet and the parts live in the box's Blobs (disk or RustFS). The owner
   downloads in the browser to disk or a USB stick. A box-side write to a stick (the inverse of Day 40's `shopper-usb`)
   is out of scope, named.
8. **Per-entity exports** (`products, prices, customers, sales, lines, tenders, stock, tax, audit`): each is a function
   returning a `ReportTable`, so `reportCsv`/`reportWorkbook` apply unchanged. Date-bound entities (sales, lines,
   tenders, audit) take `from`/`to` within the existing one-year report range; the others are "as of now". CSV is
   streamed in pages; XLSX is built in memory and **refused above 200,000 rows** with "Too many rows for Excel; use CSV
   or the archive" (Excel itself holds 1,048,576). Branch-scoped members are not given `export.run` (it is an owner/admin
   permission, org-wide).
9. **Audit.** Commands: `export.entity` (who, entity, format, range, row count), `export.archive.start` (job created),
   `export.archive.seal` (rows, bytes, manifest SHA-256), `export.archive.download`, `export.archive.delete`. Each is a
   `defineCommand`, so each writes its audit row in the same transaction. Payloads carry names and counts, never data.
10. **Versioning.** `ARCHIVE_FORMAT = 1`. `verifyArchive` refuses a higher format with "This archive was made by a newer
    Shopper (format N, Shopper X). Update Shopper before importing it." and a manifest with no `archive_format`. The
    upcaster chain for older formats arrives with the importer (Day 42) and the first format bump; there is nothing
    to upcast from yet, so none is written (no dead code).
11. **Retention.** An archive holds the whole business, so the owner can delete it (`DELETE`, audited, removes the parts
    and the row's blob keys). Jobs older than 7 days are not purged automatically (no cron for business logic); the
    list shows age and the delete button.

Out of scope (named): the importer and cloud↔box migration (Day 42/43), the till relocation handshake, ZIP64, a signed
URL for the whole archive, a box-side USB write, scheduled/automatic exports, encrypting the archive (it is signed, not
secret; the owner protects the file like a database dump), exporting till-local SQLite, real hardware.

## How I work (per your instructions)

No subagents and no Workflow tool. `feature-plan` (this file), `tdd-slice` per slice, `ui-screen` + `ui-verify` +
`playwright-cli` for the screen, `cloud-box-parity` for the workflow wiring, `pre-merge-review` (Codex `gpt-6.1-sol`)
before push. Context7 for Drizzle/Hono questions, the Cloudflare docs MCP / `cf docs search` for Workflows limits.

Per slice: failing test first → break-check (revert the fix once, watch it fail) → implement → slice tests → `vp check`
→ `vp run guard` → commit. Push once at the end, PR, bind with `ccd_pr`, watch CI and auto-fix until green, merge, then
update the Notion row (ticks, Status, Progress, remarks).

## S0 · Branch and plan

`git switch -c day41-archive-export origin/main` (done), `vp install`, `vp run services:up`, this file, commit.

## S1 · The archive format, sealed and verified

Test `tests/integration/export/archive.test.ts` (no database yet; real WebCrypto, real bytes):

- build an archive from a few in-memory files with `sealArchive`; `verifyArchive` returns the manifest and key;
  `unzip -t` on the bytes (spawned) accepts it (proves it is a real ZIP, not only our reader's idea);
- one flipped byte in a table file → refused naming the file; in `manifest.json` → signature invalid; a file replaced by
  another with a valid-looking hash → refused; a file added that the manifest does not list → refused; a listed file
  missing → refused; a manifest re-signed by another key still verifies integrity but returns that other key;
- `archive_format: 2` → the "newer Shopper" message; no `archive_format` → refused; counts in the manifest are exact.

Implementation: `packages/export/src/{zip,manifest,seal,verify}.ts` + `schemas/manifest.ts` (Valibot), stored-ZIP
writer/reader with CRC-32, `sealArchive(files, signer)`, `verifyArchive(bytes)`. Break-check: skip the hash compare →
the flipped-byte test fails.

## S2 · A consistent dump of the org

Tests `tests/integration/export/dump.test.ts` and `coverage.test.ts`:

- the fixture org (golden sales through the real sale path, a second org beside it) is dumped; per table, the NDJSON line
  count equals `select count(*)` for that org, for **every** table; the second org's rows appear nowhere;
- a snapshot is a snapshot: a sale inserted while the dump runs (a hook between two tables) is in no table, and no
  table holds a line whose sale it lacks;
- seeded secrets (password hash, PIN hash, session token, device secret, the org's session key) appear nowhere in the
  bytes; bigint values near 2^63 and money survive exactly (compared as text);
- coverage: every `org_id` table is exported or excluded with a reason; every excluded table/column exists.

Implementation: `packages/export/src/dump/{tables,snapshot}.ts`: discovery from `information_schema`, the exclusion
table, the `ctid` keyset page reader, `dumpOrg(db, orgId, sink)` where `sink.part(key, bytes)` receives each chunk. Break-check:
drop the `org_id` filter → the cross-org test fails; drop the isolation level → the in-flight sale test fails.

## S3 · The export job: tables, commands, workflow

Migration `0043_exports.sql` (+ Drizzle schema `schemas/exports.ts`): `export_job` (id UUIDv7, org_id, kind, status
`running|ready|failed|deleted`, requested_by, rows, bytes, manifest_sha256, parts jsonb, error, created_at, completed_at)
and `archive_key` (org_id unique, private_key, public_key). Both excluded from archives.

Tests `tests/integration/export/job.test.ts`:

- `runArchiveExport` driven by the in-memory workflow harness other workflows use: start → parts written, job `ready`,
  `workflow_run` completed, audit chain verifies with `export.archive.start` and `.seal`; the verified archive from the
  download assembly equals what S1 accepts;
- a failed first attempt (blob put rejects once) retries and ends with the same bytes and one job, not two;
- a second export reuses the org's key (same public key); two orgs get different keys;
- start twice with the same business key does not double the job; delete removes the parts and marks `deleted`.

Implementation: `packages/core/src/export/{start,seal,delete}.ts` commands (or in `@shopper/export` if the layering allows:
decided at the first import, see Risks), `packages/core/src/workflows/export.ts` (`runArchiveExport`),
`packages/adapters/cf/src/workflows/export.ts`, `packages/adapters/box/src/workflows/export.ts`, `apps/edge` export +
binding, `apps/box/src/app.ts` wiring. Instance id = the job's business key `export-archive_<orgId>_<jobId>`.

## S4 · Per-entity CSV and XLSX

Tests `tests/integration/export/entities.test.ts`:

- for each of the nine entities: the CSV data-row count equals the DB count for that org and range; the XLSX sheet holds
  the same rows; amounts are exact to four decimals from integers; quantities to three; a line in another org never
  appears;
- ranged entities honour `from`/`to` and refuse a range over a year and a day; a product whose name holds a comma,
  quote and newline round-trips through CSV;
- XLSX over the cap is refused with the message above while the same entity as CSV streams; each export writes one
  `export.entity` audit row with the row count.

Implementation: `packages/export/src/entities/{catalogue,customers,sales,stock,tax,audit}.ts` → `entityTables`, paged
selects (keyset on `id`) feeding `reportCsv`/`reportWorkbook`; CSV pages are concatenated by a `ReadableStream`.
Break-check: off-by-one in the page boundary → the row-count test fails.

## S5 · API, permission, tenant sweep

Tests `tests/integration/api/export.test.ts` and the sweep entries in `tests/support/security/bodies.ts`:

- `export.run` granted to owner and admin only; a cashier and a branch-scoped manager get 403 on every route;
- `POST /export/archives` → 202 `{id}`; `GET` lists and shows `running`→`ready`; `GET .../download` streams a ZIP that
  `verifyArchive` accepts and that holds the fixture org's counts; another org's job id → 404 on get/download/delete;
  a download before `ready` → 409 with a message;
- `GET /export/entities/:entity.csv|.xlsx` as in S4 over HTTP with the right `content-type` and
  `content-disposition` (`<org-slug>-<entity>-<from>-<to>.csv`).

Implementation: `packages/api/src/routes/export.ts` (+ registered in `app.ts`), permission code `export.run` in
`packages/auth` (owner/admin defaults), the streamed ZIP response from the stored parts.

## S6 · The Export screen

`packages/backoffice`: `routes/export.tsx`, `screens/export/screen.tsx`, `components/export/{entities,archive,jobs}.tsx`,
`queries/export/*.ts`, a nav item under Settings ("Data export", `export.run`). Two cards: **Download a spreadsheet**
(entity select, date range for the ranged ones, CSV / Excel buttons) and **Full copy of your business** (what it
contains, "Create archive", the job list with status, size, rows, age, fingerprint, Download, Delete). Every state:
loading skeleton (sized to the real boxes, `skeleton-audit`), empty, running, ready, failed, too-many-rows, forbidden.
Keyboard: Alt+E focuses the entity select, Enter starts, every button has a shortcut. No effects (query polling through
the data layer, as the Updates card does).

e2e `tests/e2e/portal/export/export.spec.ts`: sign in as the owner, create an archive, wait for ready, download it and
verify it with the real verifier; download a CSV and count its rows; a cashier does not see the nav item and gets the
forbidden state by URL. `ui-verify` with `playwright-cli` at 1920, 1440, 1366×768, 768 and 390: screenshots of every
state, console clean, no horizontal overflow, axe clean.

## S7 · The box

Test `tests/integration/box/drills/export.test.ts`: `drillBox()` sealed binary, a shop with a few sales, `POST
/export/archives`, wait for `ready` on Rivet, download over the box's HTTPS, `verifyArchive` accepts it, counts equal the
box database's; the egress guard sees nothing leave (the archive needs no internet). Fix whatever the run exposes,
test-first.

## S8 · Docs, review, release

Docs: `architecture.md` (export section: format, key, snapshot, limits), `layout.md` (`packages/export` no longer
empty), `deployment.md` (box exports, USB by browser), `security.md` (no credentials in an archive, the key, audit),
`testing.md` only if a new helper lands. `docs/plans/day41/verification.md`: results, break-checks, limits, the Figma
note. `pre-merge-review` (Codex `gpt-6.1-sol`), fix, re-run. Full `vp check`, `vp run guard`; targeted suites locally
(the full suites run in CI). Push once, PR (no attribution lines), bind with `ccd_pr`, CI until green (auto-fix and
push), merge, then update the Notion row: tasks ticked for what was proven, Status Done, Progress and remarks that say
plainly what is deferred (signed URL, box USB write, upcasters, ZIP64).

## Risks and how the day absorbs them

- **Layering of the job commands.** `@shopper/export` (layer 4) may not be importable from `@shopper/core` (layer 3). If
  so the commands and `runArchiveExport` live in core with the format code in `@shopper/export`, and core imports
  nothing from it except the pure builders it needs; decided when S3's first import fails the guard, not before.
- **Workflow step budget.** The single snapshot step is the pilot-scale shortcut named in Decision 4; the Cloudflare
  docs MCP is checked for the current step limits before S3 and the numbers are written in the verification file.
- **Slow shared server.** Heavy suites (the dump over the fixture org, the box drill) go in the `heavy` group only if
  they need it; the full run is CI's.
- **Figma unavailable.** Visual fidelity against Figma is not verified this day; the screen reuses shipped components
  and the verification file lists it as the open item.

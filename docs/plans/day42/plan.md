# Day 42 plan · Import + on-prem → cloud

Branch `day42-move-to-cloud` off `origin/main` (`d665ba78`, Day 41 merged). The local checkout is stale on
`day33-online-payments` with a staged `docs/plans/day33/plan.md` and a modified `pnpm-lock.yaml`: stash them
(`git stash push -m day33-leftovers`), do not discard. All data is disposable: wipe local Postgres, Rivet, RustFS and
`.shopper/` whenever that is simpler. No subagents. The planner, test-author, implementer, ui-builder and reviewer roles
run inline with their skills. This file is copied to `docs/plans/day42/plan.md` as the first commit.

## Context

Notion row **42 · Import + on-prem → cloud** (Phase 7, P0, Migration/Box/Sync). **Done when:** an on-prem shop moves to
the cloud in one evening. Tasks: archive import into a new cloud org (idempotent, resumable, verified against the
manifest). The sequencer continues at ≥ the archive's max `store_seq`. Receipt blocks and fiscal numbering carry over
with no reuse and no gaps. Till relocation handshake: drain the outbox to the old server, then a signed relocation
message, then the new base URL and device credentials, then a snapshot bootstrap. The box goes read-only after cutover.
Day 41 also deferred "the importer upcasts older archives" to today. Required test: **box → cloud: tills relocate, the
next receipt numbers continue, the fiscal sequence is unbroken.**

What the code already gives us (read on `origin/main`, not assumed):

- `@shopper/export` (Day 41): `dumpOrg` gives one repeatable-read snapshot of every `org_id` table as NDJSON parts.
  `buildManifest`/`signManifest` and `verifyArchive` exist, and so do `EXCLUDED_TABLES`/`HIDDEN_COLUMNS` plus the
  archive workflow on both runtimes (`apps/box/src/exports.ts`).
- **Ids are kept.** Store sequence is `store.last_seq`, and `allocateStoreSequence` (`packages/core/src/sequence.ts`)
  reads it. The cloud `StoreSequencer` DO keeps no cursor ("PG is the record"). Receipt numbers are `receipt_block` +
  `device.receipt_last/receipt_used`, read by `issueReceiptBlocks` (`core/src/till/receipts/blocks.ts`). Fiscal docs are
  rows and the lane adopts stranded ones (`core/src/fiscal/lane.ts`). An import that keeps every row and id therefore
  continues all three sequences without a second mechanism.
- **Trust anchor:** `signedRequest`/`verifySignedRequest` (`core/src/licence/requests.ts`). The box signs requests with
  its licence key, and the licence (signed by the issuer) names `org`. The cloud holds `licenceSigningKey`
  (`api/src/routes/licence.ts`). Tills know the issuer's public key (`buildInfo.licenceIssuer`).
- `/sync/handshake` (`api/src/sync/routes.ts`) already returns per-device state (receipt blocks, update channel), so it
  carries the relocation. The Electron main `enrol()` (`apps/till/electron/src/main.ts`) already rewrites the register
  file and restarts the host. `trust.ts` handles the box CA pin, which a cloud upstream drops.
- Insert triggers that matter: `org_seed_ledger` (AFTER INSERT ON org seeds ledger accounts and would clash with the
  imported ones) and `branch_code`/`device_code` (only fill an empty code). `audit_log_require_hash` accepts the rows
  because they already have hashes. The journal balance constraint triggers fire at commit, so the import runs in
  **one transaction**.
- Tests: `postgresFixture()` creates a fresh database per call. `tests/support/export/org.ts` builds the seeded
  fixture org (pending sale, near-2^63 `last_seq`, planted secrets).

**Your decisions (asked):** (1) credentials move with the box → cloud move over the licence-signed channel, never in
the `.shopper` file. That covers password hashes, PIN hashes and the session key, so passwords, PINs and offline proofs
keep working. (2) The box pushes the archive itself from one "Move to cloud" screen.

## The flow, end to end

```
Box portal  "Move to cloud" (owner, migration.run)
 1 box → cloud_move.status = sealing  ── box API now read-only (writes 423), tills keep selling offline into their outbox
 2 Rivet workflow CloudMove: dumpOrg + seal (Day 41 code) → POST /migration/imports {manifest, sig}  (licence-signed)
 3   PUT /migration/imports/:id/files/<path> per part/blob   (resumable: GET lists what the cloud already holds)
 4   POST /migration/imports/:id/commit {credentials}        → cloud starts ArchiveImport workflow,
                                                                replies with one signed reloc/1 message per device
 5 box stores relocations; status = moved (read-only for good)
Cloud ArchiveImport workflow: verify every file vs manifest → one transaction: org, tables in FK order, blobs,
  credentials, sequence floor, `migration.import` audit row → archive_import.status = ready
Till: next /sync/handshake to the box returns `relocation` → push outbox to the box once (refused 423 = keep it)
  → verify reloc/1 with the issuer key → POST cloud /devices/relocate {code} (409 until ready, retried)
  → same device id, new token → register file: cloud upstream, no CA pin, pull cursor reset → host restarts
  → snapshot bootstrap → outbox pushes to the cloud → receipt numbers continue from the till's own blocks
```

## Decisions (defaults; say if you want otherwise)

1. **Same ids, same org id.** The cloud org gets the archive's `org.id`. If that org already exists in the cloud and
   no import of it is in progress, the import is refused ("This shop is already in the cloud"). A slug clash is refused
   with the same kind of message.
2. **Insert = `INSERT INTO t (cols) SELECT cols FROM jsonb_populate_recordset(null::t, $1) ON CONFLICT DO NOTHING`**
   per NDJSON part. `cols` = the table's columns ∩ the keys in the archive, minus generated columns. Postgres converts
   the types, bigints never pass through JS numbers, and columns the archive lacks take their defaults. **That is the
   upcaster for additive schema changes**, which expand-then-contract guarantees. An archive whose `schema_version` is
   newer than the cloud's is refused. No upcaster functions are written today: there is no older archive format, so
   they would be dead code.
3. **Order:** tables are sorted topologically from `pg_constraint` FKs at run time (no hand list). Self-references
   (for example `cashier_session.parent_session_id`) insert in exported `ctid` order. A cycle fails loudly in the test.
4. **One transaction, one workflow step** (`SET LOCAL shopper.import = 'on'`). Migration `0044` makes the
   `org_seed_ledger` trigger skip while that flag is set. A failure rolls back to nothing, so a retry is a clean re-run.
   Once `ready`, a re-run is a no-op. Resumability lives in the upload (per-file PUTs, `GET` lists the missing paths).
   `ponytail:` one transaction at pilot scale; per-table steps if a shop outgrows one step's budget.
5. **Verification before any row:** each uploaded file is checked against the manifest on PUT (size and SHA-256) and
   again in the workflow's first step. The manifest signature is checked with its own key, and the licence's `org` must
   equal `manifest.org.id`. That licence check is the trust decision Day 41 left to the importer.
6. **Sequence floor:** after the inserts, `store.last_seq = greatest(last_seq, max(sale.store_sequence))` per store, and
   `device.receipt_last = greatest(receipt_last, max(receipt_block.end))`. A belt over the imported rows: the test
   checks that the next sequence is `> max` and the next receipt number is the last one plus one.
7. **Credentials** travel in the commit body (licence-signed, TLS): `account.password` per user, `cashier_pin` rows and
   `session_key`. They are applied inside the import transaction and then nulled in `archive_import`. They are never
   written to blobs or audit (the audit payload carries counts only).
8. **Relocation message `reloc/1`** = `{orgId, deviceId, upstream, code, expiresAt}`, Ed25519-signed by the cloud's
   `licenceSigningKey`. The till verifies it with `buildInfo.licenceIssuer` and refuses another device's message. The
   one-time code is stored hashed in `archive_import.relocations`. `POST /devices/relocate` revokes nothing on the box,
   issues a new `device_credential` for the **existing** device and returns 409 "still moving" until the import is
   `ready`. A code expires after 7 days.
9. **Read-only box:** a box-only middleware in `apps/box` refuses every non-GET with 423 "This shop moved to the cloud"
   once `cloud_move` exists, except sign-in, `/migration/*` and `/sync/handshake`. A till's 423 push is treated as
   "keep the outbox", the same as offline. That is the "drain to the old server" step: the till tries the box first,
   and whatever the box refuses goes to the cloud after relocation, so nothing is lost and nothing is double-counted
   (acceptance is idempotent by local id).
10. **New tables (0044):** `archive_import` on the cloud (`org_id` with no FK because the org arrives later; status,
    manifest, received paths, relocations, credentials until applied, error) and `cloud_move` on the box (status,
    import id, relocations, delivered-at per device, error). Both go in `EXCLUDED_TABLES` with a reason, and the Day 41
    coverage test enforces it. New permission `migration.run` (owner).
11. **The import function lives in `@shopper/export`** (`runArchiveImport`) with a Cloudflare Workflow shell and a
    Rivet shell (`cloud-box-parity`). Day 43 (cloud → box) reuses it unchanged. `CloudMove` is box-only.

Out of scope (named): cloud → box (Day 43). Importing a `.shopper` file uploaded by hand in the cloud portal. Billing or
a subscription for the new cloud org. Deleting the box's data after the move. ZIP64. Real hardware and a real
Cloudflare deploy.

## How I work

Skills: `feature-plan` (this file), `tdd-slice` per slice, `cloud-box-parity` (workflow shells), `ui-screen` +
`ui-verify` + `playwright-cli` (screens), `pre-merge-review` (Codex `gpt-6.1-sol`) before the push. Context7 for Drizzle
and Hono, and `cf docs search` for Workflow step limits. Per slice: failing test → break-check (undo the fix once and
watch it fail) → implement → `vp check` → `vp run guard` → commit. Push once at the end.

## Slices

**S0 · Branch.** Stash the leftovers, `git switch -c day42-move-to-cloud origin/main`, `vp install`,
`vp run services:up`, copy the plan, commit.

**S1 · The importer.** `tests/integration/migration/import.test.ts`: export the fixture org from database A
(`dumpOrg` + `signManifest`), import it into a fresh database B, then:

- every table's rows equal A's, compared as `to_jsonb` text minus hidden columns, and the other org is absent;
- a second run changes nothing (same counts, no new audit row);
- one flipped byte in a part is refused with **zero** rows written;
- `schema_version` + 1 is refused, and an archive missing a newer nullable/defaulted column imports with defaults;
- the next `allocateStoreSequence` is above the archive's max `store_sequence` (the near-2^63 value too);
- `issueReceiptBlocks` continues from the last block, and the ledger is not double-seeded;
- `verifyChain` passes with `migration.import` as the newest row.
  Code: `packages/export/src/import/{order,insert,run}.ts`, migration `0044` (trigger flag, two tables, permission).
  Break-checks: drop the sequence floor; drop the trigger flag.

**S2 · Cloud import API.** `tests/integration/migration/api.test.ts` with real `signedRequest`s: unsigned → 401, a
licence for another org → 403, a file whose hash differs → 422, commit with files missing → 409 listing them,
`GET` lists received paths (resume), commit → workflow → `ready` and signed relocations returned, a second commit
returns the same relocations. Credentials are applied (old password and PIN verify on B) and nulled afterwards.
Code: `packages/api/src/routes/migration/{imports,files}.ts`, CF workflow class + binding in `apps/edge`, Rivet
launcher, tenant-sweep `PUBLIC` entries with reasons, bodies in `tests/support/security/bodies.ts`.

**S3 · Device relocation.** `tests/integration/migration/relocate.api.test.ts`: before `ready` → 409; a good code →
token for the same device id, which then handshakes; reuse, a wrong device or an expired code → 401; a tampered
`reloc/1` fails `verifyRelocation`. Code: `packages/auth/src/devices/relocate.ts` (`defineCommand`),
`packages/core/src/licence/relocation.ts` (sign/verify, reuses `keys.ts`).

**S4 · The box move.** `tests/integration/migration/move.test.ts`: the box app (`createBoxApp`) on DB A against the
cloud API on DB B in-process: start → writes 423 except the allowlist, the workflow runs to `moved`, `/sync/handshake`
returns that device's relocation and marks it delivered, and a cloud failure mid-upload resumes without re-sending held
files. Code: `packages/core/src/migration/move.ts` (commands), `packages/adapters/box/src/workflows/move.ts`,
`apps/box/src/{move,readonly}.ts`, handshake field in `api/src/sync/routes.ts` + its schema.

**S5 · The till relocates (the row's test).** `tests/integration/migration/tills.test.ts`. Box and cloud are in-process
and two till hosts run through the existing sync test harness. Till 1 has an unsynced sale in its outbox at cutover.
After relocation:

- both tills handshake with the cloud as the same device ids;
- till 1's outbox lands in the cloud;
- each till's next receipt number is its last + 1 (no reuse, no gap);
- the next store sequence and the next fiscal document number continue the box's;
- the box refuses a write.
  Code: `packages/adapters/box/src/till/host/{sync,relocate}.ts` (handshake → relocation event), Electron
  `apps/till/electron/src/relocate.ts` (verify, final push, `/devices/relocate`, rewrite the register file without the CA,
  reset the pull cursor, restart via `enrol()`'s path).

**S6 · Screens.** The box portal gets Organisation → **Move to cloud** (`packages/backoffice/src/screens/migration/move/
screen.tsx`, `components/migration/move/*`, `queries/migration/move.ts`), shown only on a box (the runtime capability
flag) and behind `migration.run`. States: ready-to-start, confirm dialog (what happens, the evening checklist,
"Type MOVE"), sealing, uploading n/m, importing, moved (tills relocated n/m, each with delivered/relocated), failed +
retry, and a read-only banner on every box page afterwards. The till connection screen gets "Moving to the cloud…" and
"Could not move" states. e2e `tests/e2e/migration/move.spec.ts`. `ui-verify` at 1920/1440/1366/768/390 plus the till
size, with keyboard, axe, console and overflow checks. Shortcuts: M opens the move, Enter confirms. Figma: only one
frame could be read before the View-seat rate limit (a form field), so the screens follow shipped portal patterns
(the Day 41 export screen, `Alert`, `Badge`, `Progress`). The verification file says so.

**S7 · Docs, review, ship.** `docs/engineering/migration.md` (flow, trust, limits), `security.md` (credentials cross
only the licence-signed move, never the file), `platforms.md` (the new workflow), and `docs/plans/day42/
verification.md`. `pre-merge-review` (Codex `gpt-6.1-sol`): fix the findings test-first. Then push, open the PR, bind it
with `ccd_pr`, watch CI and auto-fix until green, merge, fast-forward local `main`, and update the Notion row (ticks,
Status Done, Progress, Remarks).

## Verification

- `vp test --run tests/integration/migration` (five suites), plus the whole `tests/integration/export` suite (the
  coverage test now covers the two new tables) and the tenant sweep.
- `vp check`, `vp run guard`, `vp run build`. e2e `move.spec.ts` against the real box SPA and the cloud API.
- Manual drill: box (`apps/box`) + cloud (`vp run dev`) + one till host locally. Ring up a sale, move, ring up again,
  and check the receipt number, the store sequence and the fiscal number continue in the cloud portal.

## Risks and named limits

- The whole import is one transaction in one workflow step. That is fine at pilot scale. The ceiling is the Workflow
  step budget on Workers.
- A part's PUT must fit the request body limit (5,000-row parts are small, and Day 41 caps blobs at 64 MB).
- A till that is switched off all evening relocates whenever it next reaches the box. The box keeps serving its
  relocation read-only, and the code lasts 7 days, after which it is re-enrolled by hand.
- Credentials in transit live in `archive_import` only until applied. If the import fails, they are cleared and the box
  re-sends them on retry.

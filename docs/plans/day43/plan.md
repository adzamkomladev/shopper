# Day 43 plan · Cloud → on-prem

Branch `day43-cloud-to-box` off `origin/main` (`ea920c26`, Day 42 and the admin org detail merged). All data is
disposable: wipe local Postgres, Rivet, RustFS and `.shopper/` whenever that is simpler. No subagents. The planner,
test-author, implementer, ui-builder and reviewer roles run inline with their skills (`feature-plan`, `tdd-slice`,
`ui-screen`, `ui-verify` + `playwright-cli`, `pre-merge-review`). This file is the first commit.

## Context

Notion row **43 · Cloud → on-prem** (Phase 7, P0, Migration/Box). **Done when:** a cloud shop moves on-prem in one
evening. Tasks: the box installer / setup wizard accepts `--import archive.shopper`. The cloud org is frozen read-only
during cutover and archived after verification. A licence is issued for the migrating org. The same relocation
handshake runs in reverse. A verification report gives row counts and checksums per table, and per-day sales and tax
totals, reconciled. Required test: **Cloud → box full cutover; verification report all green.**

What the code already gives us (read on `origin/main`):

- **Day 41:** `requestArchiveExport` seals an archive with the `export-archive` Workflow on both runtimes. The cloud
  serves it at `/export/archives/:id/download`. `verifyArchive(bytes)` checks a `.shopper` file using only the file,
  and the manifest is signed by a per-database key (`manifest.public_key`).
- **Day 42:** `importArchive` (`@shopper/export`) writes an archive into an empty database with every id, in one
  transaction, with the credentials applied and the sequence floors raised. It already says "Day 43 reuses it
  unchanged". `relocateDevice` redeems a `reloc/1` code against `archive_import.relocations`.
  `relocationHandshake` hands a register its relocation and issues no receipt blocks. `relocateRegister` (till host)
  verifies and redeems a relocation. `credentials(db, orgId)` (in `workflows/move.ts`) reads password hashes, PIN
  hashes and the session key. `refuseWhenMoved` makes a moved box answer 423.
- **Box first boot:** `apps/box/src/install.ts` (`GET`/`POST /install`) takes the setup code and a licence. It shows
  the box's licence **request code** (`{machine, key}`) and `acceptLicence` binds the licence to the machine and the
  box key. `boxLicence().send` signs requests with the licence. `SHOPPER_LICENCE_URL` is the cloud API.
- **Licences** are issued only by `tooling/licence/issue.ts` from a request code. The cloud holds the issuer key
  (`licenceSigningKey`).
- **Reports:** `foldSales` re-derives per-day gross, tax (and each levy), net and refunds from the raw sale and refund
  rows.

## The flow, end to end

```
Cloud portal  Organisation → Move on-prem (owner, migration.run, cloud only)
 1 startOnPremMove: box_move row (status open) + Day 41 archive export   → org frozen: member writes 423,
     register pushes 423, handshakes hand out no new receipt blocks (registers keep selling into their outbox)
 2 archive sealed → screen: "Download archive" (.shopper) + "Box request code" field
Box   sudo sh shopper-box-installer.run --import shop.shopper   → file kept at /var/lib/shopper/import.shopper,
      SHOPPER_IMPORT=… in box.env → first-boot wizard opens in import mode: "Move <shop> to this box", shows request code
Cloud 3 owner pastes the request code → issueMoveLicence: lic/1 for this org, this machine and key → licence.json
Box   4 wizard: setup code + licence → POST /install/import:
        acceptLicence (machine, key) · licence.org = manifest.org.id · verifyArchive(file)
        → POST <cloud>/migration/handover/claim {upstream, manifest sha256}   (licence-signed)
          cloud: licence is the one issued for this move, manifest is this move's archive → reloc/1 per register
          (upstream = the box, one-time code), status claimed → {credentials, codes: {deviceId: {codeHash, expiresAt}}}
        → archive_import row (status importing, codes) → importArchive(credentials) → archive_import ready
        → POST <cloud>/migration/handover/report {report}   (licence-signed)
          cloud: same report over its own frozen rows, compared → stored; all green → status archived
        → wizard shows the report table, then "Sign in with your usual email and password"
Till  next cloud /sync/handshake → {relocation} (only once archived) → host: box upstream on the LAN and no box CA yet
      → main pins https://shopper.local/ca.crt, restarts → relocateRegister → POST <box>/devices/relocate {code}
      → same device, new token → register file: box upstream + CA → restart → outbox pushes to the box
```

## Decisions (defaults; say if you want otherwise)

1. **Reuse, not a mirror image.** The box's arrival is a Day 42 `archive_import` row (status, codes, report), so
   `relocateDevice` and `/devices/relocate` work on the box unchanged. The cloud's departure is a new `box_move` table:
   `open → claimed → archived`, or `cancelled`. Its fields are `export_job_id`, `licence_id`, `licence` (the issued
   lic/1, which is public), `box_upstream`, `relocations` `{deviceId: {message, deliveredAt}}`, `report`, `error`,
   `completed_at`. Both new rows go in `EXCLUDED_TABLES`. Migration `0045`: `box_move` and `archive_import.report`.
2. **No new Workflow.** Sealing is Day 41's `export-archive` Workflow. Everything after it is driven by the owner's
   clicks and two licence-signed requests that write the row. Nothing polls and nothing sleeps. A move left open does
   not expire: the owner cancels it. The rule "business processes that wait on people = a Workflow" is met by the
   archive Workflow plus a request-driven row. A waiting Workflow would only add a timeout nobody asked for. Ask if
   you want one (for example, auto-cancel after 7 days).
3. **Frozen = one org-scoped check.** `onPremMove(db, orgId)` returns the open, claimed or archived `box_move`:
   - members: `refuseWhileMovingOut` (cloud) returns 423 on every non-GET except `/api/auth`, `/migration/onprem*`,
     `/migration/handover/*` and `/export/archives*`;
   - registers: every `/sync/*` POST except the handshake returns 423 (as on a moved box), so sales stay in the outbox
     and go to the box after relocation;
   - handshake: no receipt blocks from the freeze on (numbers issued after the snapshot would be unknown to the box);
     once `archived`, the register's `reloc/1` (`relocationHandshake`, which now takes the move's row and its own
     `deliver`).
     `/billing/status.move` becomes `{direction: "cloud" | "box", status, target}` so the existing banner speaks for
     both directions.
4. **"Archived" means the cloud keeps the shop read-only for good** (status `archived`, banner "This shop now runs on
   its own server"). Nothing is deleted. Deleting the cloud copy later is a separate, owner-requested job (named, not
   built).
5. **The licence is issued by the cloud, for this move only.** `POST /migration/onprem/licence {request}` (owner) runs
   `issueMoveLicence` (`defineCommand`, audited by licence id, machine hash and terminals). It uses the request code
   the box shows, `org` = this org, `site` = the shop name, `terminals` = max(5, registers), maintenance = 1 year. One
   licence per move: issuing again replaces it until the box claims. `issueFromRequest` moves from `tooling/` into
   `@shopper/core/licence` (`licenceFromRequest`) and the tool calls it. **Pricing and payment for the licence are out
   of scope.**
6. **Trust on the claim:** a genuine licence (issuer signature), `licence.id` = the move's licence, the
   `sha256(manifest.json)` the box sends equals the sealed job's manifest, and the move is `open` (or `claimed` by the
   same licence, so a box that crashed mid-import claims again and gets fresh codes). Credentials (password hashes,
   PIN hashes, session key) travel **only** in that signed answer, never in the file. This is the reverse of Day 42's
   commit body.
7. **Verification report** (`reconciliationReport(db, orgId)` in `@shopper/export`, run in one repeatable-read
   snapshot at `timezone = 'UTC'`):
   - per archived table: `rows` and `checksum` = `md5(string_agg(to_jsonb(t) - hidden, E'\n' order by text))`. The
     hidden columns are `HIDDEN_COLUMNS`. Ordering by the row text means no primary key is needed;
   - per Accra day: sales count, gross, tax, VAT, NHIL, GETFund, COVID, net, refunds, refund tax, from `foldSales`
     over every store day that has a sale or refund (re-derived from raw rows, not the imported rollups);
   - `compareReports(cloud, box)` → `{ok, tables: [{table, cloud, box, ok}], days: [...]}`. Three tables are compared
     only by `rows` up to the archive: `audit_log` (the move audits itself on both sides), `workflow_run` (the
     sealing Workflow finishes after its own snapshot) and `export_job`. The audit chain is checked with
     `verifyChain` on the box instead. Everything else must match exactly.
8. **Till, reversed:** `relocateRegister` is unchanged (it already takes `upstream` from the signed message). The till
   host, given a LAN upstream while it has no box CA, asks Electron to pin `<upstream>/ca.crt` first (`pin-box` →
   `pinBoxCa` → restart). It then relocates over the pinned CA. `relocate()` keeps the pinned CA for a LAN upstream and
   drops it only for the cloud. Trust on first use matches first enrolment on a box, and the one-time code works only
   on the box that claimed the move.
9. **Installer:** `install.sh --import <file>` copies the file to `/var/lib/shopper/import.shopper` (shopper, 0600)
   and writes `SHOPPER_IMPORT=` into `box.env`. `header.sh` passes the caller's directory so a relative path works.
   With `SHOPPER_IMPORT` set, `GET /install` adds `import: {shop, createdAt}` (from a verified manifest, cached in the
   process), and `POST /install` (create a new shop) is refused with "This box is set up to import <shop>".
10. **Cancel:** `DELETE /migration/onprem` (owner) while `open` or `claimed` sets `cancelled`, the org takes changes
    again and the codes are void. A box that already imported must be reinstalled. The screen says so before you
    confirm.

Out of scope (named): deleting the cloud copy after archiving, licence pricing and payment, a hand-uploaded archive
without a move, moving between two clouds, ZIP64, the Electron path on real hardware (no Windows today), and running
the docker installer suite with `--import` (the flag is a few shell lines, exercised by hand in a container if time
allows).

## Slices

**S0 · Branch and plan.** `git switch -c day43-cloud-to-box`, `vp install`, `vp run services:up`, commit this file.

**S1 · Reconciliation report.** `tests/integration/migration/report.test.ts`: export the fixture org from database A,
then import it into B (Day 42 helpers):

- `compareReports(report(A), report(B))` is `ok`, with every archived table and at least one sales day listed;
- changing one row's price on B makes that table, and only that table, not ok;
- a sale deleted on B makes its day's gross and tax differ;
- the report never contains a hidden column's value (a planted password does not change the checksum).
  Code: `packages/export/src/verify/report.ts`, `compare.ts`. Break-check: drop the `- hidden` subtraction.

**S2 · Cloud side: start, freeze, licence, cancel.** `tests/integration/migration/onprem.test.ts` (API, owner session
via the existing auth test helpers):

- `POST /migration/onprem` returns 202, the archive seals, and `GET` shows `open` with the export job;
- a member's product write returns 423, a register push returns 423, the handshake has no `receipts`, and GETs and
  sign-in work;
- `POST /migration/onprem/licence {request}` returns a lic/1 that verifies against the issuer, with org = this org and
  the machine and key from the request;
- a second start returns 409, and `DELETE` sets `cancelled`, after which writes work again;
- a cashier without `migration.run` gets 403. Code: migration `0045`, `packages/db/pg/src/schemas/moves.ts`,
  `packages/export/src/onprem/{start,licence,cancel}.ts`, `packages/core/src/licence/request.ts`,
  `packages/api/src/routes/onprem.ts`, `packages/api/src/middleware/moved.ts` (org-scoped guard),
  `api/src/sync/routes.ts`. The tenant sweep gets bodies for the three writes. The table and permission counts in the
  schema tests are updated in the same slice.

**S3 · Handover endpoints.** `tests/integration/migration/handover.test.ts` with real `signedRequest`s:

- unsigned → 401;
- a licence for another org → 403, and a genuine licence that is not the move's → 403;
- a manifest hash that is not the move's archive → 409;
- a claim before the archive is sealed → 409;
- claim → credentials and one code per register, status `claimed`; claiming again → fresh codes, and the old
  relocation messages are replaced;
- report with a mismatch → stored and `ok: false`, status stays `claimed`, no relocation is handed;
- report all green → `archived`, and the handshake hands `reloc/1` with `upstream` = the box.
  Code: `packages/export/src/onprem/{claim,report}.ts`, `api/src/routes/migration.ts` (the signature middleware is
  narrowed to `/migration/imports*` and `/migration/handover/*`), sweep `PUBLIC` entries with reasons.

**S4 · Box import (the wizard's API).** `tests/integration/box/import.test.ts`: `boxInstall` with `SHOPPER_IMPORT`
pointing at a real sealed archive, a temp licence dir and a temp machine id:

- `GET /install` shows the shop's name and the request code;
- `POST /install` (new shop) is refused;
- a wrong setup code → 403;
- a licence for another org → 422 with nothing written;
- a damaged archive → 422 with nothing written;
- a good one → 201, the org is in the box with every row, the cloud is `archived`, and the response carries the
  green report. Code: `packages/export/src/onprem/arrive.ts` (claim → import → report, with the cloud reached through
  `deps.cloud`), `apps/box/src/install.ts` (`POST /install/import`), `apps/box/src/app.ts` wiring.

**S5 · The row's test: full cutover.** `tests/integration/migration/onprem.cutover.test.ts`. Cloud (fixture org, two
registers trading, one deep into its second block) and box in-process:

- owner starts the move and the archive seals; the owner issues the licence from the box's request code;
- the box imports through `POST /install/import`;
- **the report is all green** (every table and every day);
- the cloud is archived, and a push to it still returns 423;
- each register's cloud handshake hands its `reloc/1`, and `relocateRegister` against the box returns the same device
  and the same branch and register codes;
- the box hands back exactly the blocks each register holds, and the next block continues after the last;
- the next store sequence on the box continues after the cloud's;
- pending fiscal documents are identical;
- the owner's password and a cashier's PIN verify on the box.
  Code: `packages/adapters/box/src/till/host/relocate.ts` (`pin-box` for a LAN upstream),
  `apps/till/electron/src/{main,register}.ts`. The Electron part is not exercised by this test.

**S6 · Installer flag.** `tooling/installer/{install,header}.sh` `--import`. Exercised by building the installer and
running `sh install.sh --import` up to the env write in a throwaway container, if time allows. Otherwise named as not
run.

**S7 · Screens.**

- Cloud portal: Organisation → **Move on-prem** (`screens/migration/onprem/screen.tsx`,
  `components/migration/onprem/{card,licence,report}.tsx`, `queries/migration/onprem.ts`, nav item `cloud: true`,
  `migration.run`). States: ready to start; confirm dialog (what freezes, the evening checklist, "Type MOVE");
  preparing the archive; archive ready (download, request code → licence with Copy and Download); waiting for the box;
  report with mismatches (table) and Cancel; archived (registers relocated n/m); cancelled; failed export with Try
  again.
- Box first boot: import mode (`components/install/import.tsx`): the shop's name, the request code, setup code and
  licence, "Move <shop> to this box", importing, the green report, then done. Mismatch and refused states.
- Banner: `move.direction` wording on both.
- Shortcuts: M starts the move, L focuses the request code, Enter confirms.
- e2e: `tests/e2e/portal/migration/onprem.spec.ts` (cloud screen states with the API mocked where the box is needed)
  and the box import screen. `ui-verify` at 1920/1440/1366/768/390 with keyboard, axe, console and overflow checks.
- Figma: the six frames given are till and portal screens (dashboard, checkout, sign-in) with no migration frame. The
  screens follow the shipped Day 42 Move to cloud card and the install wizard, and the verification file says so.

**S8 · Docs, review, ship.** `docs/engineering/migration.md` (Cloud → box: flow, trust, report, limits), `security.md`
(the cloud issues a licence only for its own org's move, and credentials cross only in the signed claim answer),
`docs/plans/day43/verification.md`. `pre-merge-review` (Codex `gpt-6.1-sol`): fix the findings test-first. Then push
once, open the PR, bind it with `ccd_pr`, watch CI and fix it until green, merge, fast-forward `main`, and update the
Notion row (ticks, Status Done, Progress, Remarks).

## Verification

- `vp test --run tests/integration/migration tests/integration/box/import.test.ts`, the export coverage test, the
  tenant sweep, and the schema-count tests.
- `vp check`, `vp run guard`, `vp run build`. The e2e specs for both screens.
- Break-checks: hidden-column subtraction (S1), the freeze guard (S2), the licence-is-the-move's check (S3), and the
  archived-only relocation (S5).

## Risks and named limits

- One request does the whole import on the box (as Day 42's one transaction). That is fine at pilot scale. A large
  shop would move the import into the box's own Workflow.
- A report that is not green leaves the cloud frozen and the box holding a copy. The owner cancels on the cloud and
  reinstalls the box. There is no automatic repair.
- Trust on first use for the box CA during relocation, as at first enrolment.
- A lost `/devices/relocate` answer spends the code (Day 42's limit, unchanged).

# Moving a shop: box → cloud (Day 42), cloud → box (Day 43), the round trip and the wizards (Day 44)

An on-prem shop moves to the cloud in one evening. The owner presses **Move to cloud** on the box. The box seals a
Shopper Archive (Day 41) and sends it to the cloud. The cloud imports it into an empty org with the same ids. Each
register then follows the shop the next time it reaches the box. Cloud → box (Day 43) runs the same pieces the other
way round, and is described at the end.

## The flow

```
Box portal  Organisation → Move to cloud (migration.run, box only)
 1 requestCloudMove: cloud_move row, status sealing  → every box write is 423 from here (refuseWhenMoved)
 2 CloudMove workflow (box): runArchiveExport (Day 41) → POST /migration/imports {manifest, signature}
 3   GET /migration/imports/:id (what the cloud already holds) → PUT …/files/<path> for each missing file
 4   POST …/commit {credentials} → 202 {status, relocations: reloc/1 per register} → cloud_move moved
Cloud  ArchiveImport workflow: importArchive (one transaction) → archive_import ready, credentials nulled
Till   next /sync/handshake on the box → {relocation} and no receipt blocks → relocateRegister:
       verify with the issuer key → POST <cloud>/devices/relocate {code} (409 = still importing, retried every 15 s)
       → new token for the same device → Electron rewrites the register file (cloud upstream, no box CA) and restarts
```

## What carries the sequences

The import keeps every row and id, so nothing is renumbered:

- **Store sequence**: `store.last_seq` is imported, then floored to the archive's highest `sale.store_sequence`.
- **Receipt numbers**: `receipt_block` rows and `device.receipt_last`/`receipt_used` come across. A relocated
  register's first cloud handshake is handed exactly the blocks it holds and sells on from its own counter. The moved
  box issues no blocks: numbers it handed out after the snapshot would be unknown to the cloud.
- **Fiscal numbers** are the receipt numbers (`invoiceNumber = receiptNumber`), and pending `fiscal_doc` rows are
  imported as they were. The cloud's lane adopts them.

`tests/integration/migration/tills.test.ts` holds all three: same branch and register codes, the same blocks, the next
block after the last, and the next store sequence after the box's.

## Trust

- Every call to `/migration/imports*` is signed with the box's licence key (`signedRequest`). The cloud verifies it
  against the issuer (`licenceSigningKey`), and the licence's `org` must equal the archive manifest's org (403
  otherwise). The signed message includes the full request path, which the box sends in `shopper-path`. The verifier
  accepts it only when it ends with the path it served, so a host that strips `/api` still verifies.
- An org that already exists in the cloud is refused (409 "This shop is already in the cloud.").
- Each uploaded file is checked against the manifest's size and SHA-256 on PUT, and again by the import.
- **Credentials** (password hashes, cashier PIN hashes, the session key) travel only in the signed commit body. They
  are never written to the archive or a blob, and never put in an audit payload. They wait in `archive_import` until
  the import applies them, then they are nulled, whether the import succeeds or fails.
- A **`reloc/1`** message is `{orgId, deviceId, upstream, code, expiresAt}`, signed with the issuer key. A register
  verifies it with `buildInfo.licenceIssuer` and ignores a message for another device. The one-time code is stored
  hashed, works once, and expires after 7 days.

## The box after the move

The box only reads. Sign-in, the move screen and `/sync/handshake` stay open, and every other write is 423 "This shop
has moved to the cloud". A register whose push is refused keeps its outbox, which goes to the cloud after it
relocates. Acceptance is idempotent by local id, so nothing is counted twice. Every page of the box portal shows a
banner (from `/billing/status`, which now carries `move`).

## Named limits

- **One transaction for the whole import** (`ponytail:` in `workflows/import.ts`). This is fine at pilot scale. The
  ceiling is a Workers Workflow step's budget, and the upgrade path is a step per table.
- The move finishes at commit. The cloud import may still be running, and registers wait it out (409, retry).
- A register's pull cursor is not reset. `store_change` sequence numbers carry over with the import, so it pulls on
  from where it was.
- The uploaded copies under `imports/` stay in the cloud's bucket after the import.
- `archive_import` rows are written before the org exists, so they cannot be audited per org. The import's own audit
  row records `importId` and `licenceId` instead.
- A register that stays off for more than 7 days must be enrolled again by hand.
- **A commit whose answer is lost stays locked.** Once the commit has gone out, a failure leaves the box read-only
  with the reason on the move screen (`migration.move.stall`), and offers no Try again. The cloud may already hold
  the shop, and a reopened box would take sales the cloud never sees. Support resolves it; a commit sent again is
  answered the same.
- **A relocation whose answer is lost spends the code.** If `/devices/relocate` commits but the register never
  stores its new token, that register is enrolled again by hand. The code stays single-use on purpose: making it
  re-redeemable would let the message alone take a device over.
- The required test drives the relocation, the handshakes and both databases. It does not push a real outbox sale to
  the cloud: push acceptance is unchanged code, covered by the sync suites.

## Cloud → box (Day 43)

A cloud shop moves onto its own box in one evening. The owner starts it in the cloud. The box is installed with the
sealed archive, takes the shop over at first boot, and reports what it holds. The cloud archives itself only when that
report matches its own, and only then do the registers move.

```
Cloud portal  Organisation → Move on-prem (migration.run, cloud only)
 1 POST /migration/onprem: box_move open + export-archive (Day 41) → member writes and register pushes are 423,
   handshakes hand out no receipt blocks (refuseWhileLeaving, refuseRegistersWhileLeaving)
 2 the owner downloads the sealed archive, pastes the box's request code → POST /migration/onprem/licence (lic/1)
Box  sh shopper-box-installer.run --import archive.shopper → SHOPPER_IMPORT=/var/lib/shopper/import.shopper
 3 first boot: POST /install/import {code, licence} → setup code + acceptLicence → arriveFromCloud:
   verifyArchive → licence-signed POST <cloud>/migration/handover/claim {upstream, manifestSha256}
   → {credentials, codes} (box_move claimed; reloc/1 messages kept in the cloud) → importArchive (one transaction)
   → reconciliationReport → POST …/handover/report → compareReports in the cloud
 4 every table and day agrees → box_move archived (for good); otherwise it stays claimed with the report shown
Till  next cloud handshake → {relocation} → unpinned LAN box: Electron pins its CA and restarts → relocateRegister
      against the box → new token for the same device; the box CA is kept
```

- **The verification report** (`@shopper/export/reconcile`) is computed the same way on both sides, in one
  repeatable-read transaction: per table, the row count and an md5 over the sorted `to_jsonb` lines minus hidden
  columns. Per store day, gross, tax, levies, net and refunds come from `foldSales`, the reports' own fold. The audit
  chain is cut at the box's last pre-import `chain_seq` (the import adds its own row), and the export's own workflow
  rows are left out. `tests/integration/migration/report.test.ts` shows that a planted secret does not change a
  checksum, and that one damaged sale names the table and the day.
- **Trust.** `/migration/handover/*` takes only licence-signed requests. The licence must be the one this move issued
  (403 otherwise), the move must be open or claimed (409), and the manifest's SHA-256 must be the sealed archive's
  (409). Credentials go only in the claim's answer. Claiming again (a box cut off mid-way) issues fresh codes. On the
  box, the import is a no-op once the org exists, so `/install/import` stays open until the cloud has agreed.
- **The cloud's own workflows pause.** While a move is open or claimed, and for good once archived, the watchdog
  starts no store day, billing period, audit anchor or settlement for the shop. A store day already running stops at
  its next wake (the rollup catches up the missed days later). A billing period that falls due holds its invoice and
  skips dunning, checking again daily until the move ends. A move called off is picked up by the next nightly watchdog.
- **The cloud after the move** is archived read-only for good. Sign-in, reads, the move screen, archive downloads and
  the register handshake stay open. Calling the move off (open or claimed) unfreezes it. A box that imported a
  cancelled move must be reinstalled.
- **Named limits.** The box's import runs in one request. If the report disagrees, the cloud stays frozen until the
  owner calls the move off; nothing repairs a mismatch. The box CA is trusted on first use, as at enrolment. A box with
  no `SHOPPER_LICENCE_URL` reaches the cloud its registers sync to (`buildInfo.tillUpstream`).

## The round trip (Day 44)

A shop can go cloud → box → cloud. After a move on-prem the cloud holds the shop only as an archived departure
(`box_move.status = 'archived'`). When that box moves to the cloud, `openImport` accepts it (any other existing org is
still 409), and `importArchive` replaces the archived copy in its one transaction: it deletes every row of the org,
children before parents (`tableOrder` reversed), then writes the box's archive. The `box_move` row goes too, so the
org is no longer frozen and the watchdog takes it up again.

- **History guards.** `0046_replace.sql` lets `shopper_reject_history_change` and `shopper_preserve_sale` pass a
  `DELETE` only when the transaction-local `shopper.replace` equals the row's `org_id`. Updates, truncates and every
  other org's rows are still refused.
- **The audit chain** is the cloud's own up to the archive it left with, then the box's continuation, then the
  import. The cloud's rows about the move after sealing (licence, claim, verdict) forked from the box's and are
  deleted; the import's audit row keeps their head as `replaced: {chainSeq, hash}`.
- **Proof:** `tests/integration/migration/roundtrip.test.ts`: every table and day agrees with the box at departure,
  every blob is the box's, the chain verifies from its first entry, and the org takes changes again.

## The wizards (Day 44)

Both move screens open with the same pre-flight panel (`components/migration/preflight.tsx`), fed by `checks` on
`GET /migration/onprem` and `GET /migration/move` (`preflight()` in `@shopper/export`):

- **The shop looks closed:** no sale in the last 15 minutes. Advice only.
- **Dry run:** `POST /migration/dryrun` (either runtime, `migration.run`) seals a Day 41 archive with nothing frozen;
  `GET /migration/dryrun/:id` reads it back through `verifyArchive` (a part that changed size or vanished is a failed
  dry run, not an error). The check passes for a sealed archive under a day old.
- **Cutover window:** `cutoverMinutes(bytes)`, a fixed guess (2 minutes + 1 per 10 MB, `shortcut:`) until a pilot
  move is measured. Scheduling a move for later is not built.
- **Rollback** copy at each stage says what is still possible; the runbooks are in `docs/runbooks/migration/`.

# Moving a shop: box → cloud (Day 42)

An on-prem shop moves to the cloud in one evening. The owner presses **Move to cloud** on the box. The box seals a
Shopper Archive (Day 41) and sends it to the cloud. The cloud imports it into an empty org with the same ids. Each
register then follows the shop the next time it reaches the box. Cloud → box (Day 43) reuses the importer unchanged.

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
- The required test drives the relocation, the handshakes and both databases. It does not push a real outbox sale to
  the cloud: push acceptance is unchanged code, covered by the sync suites.

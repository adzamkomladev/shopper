# @shopper/audit

`defineCommand()` owns the PostgreSQL transaction for every business mutation.
It locks the organization's chain before business writes, then appends one SHA-256
entry containing trusted actor/role/device/branch/approver context, entity,
before/after snapshots, reason, device/server time and the build's product version.
Use JSON data in payloads and snapshots. PIN, password, token, secret, credential,
authorization and cookie fields are redacted recursively. Avoid secrets in free
text; the logger cannot infer which words in a reason are confidential.

The canonical v1 projection sorts object keys and fixes the signed fields, so PG
JSONB ordering and future unrelated database columns do not change old hashes.
`chain_seq` orders entries per organization; `prev_hash` links them. Organization
locks serialize transactions even across separate connections and runtimes.
Database triggers reject updates, deletes, truncation and new unhashed rows.

`verifyChain(rows, expectedFinalHash?)` names the first failing entry. Supply rows
from one org in `chain_seq` order. An externally retained final hash detects tail
truncation; a self-contained chain alone cannot prove that its tail is complete.
`verifyChain` also takes a start `{ seq, hash }`, so `verifyStream` in `@shopper/core/audit` re-hashes a
stream in pages of 2000 rows without loading six years at once, and checks every `audit_anchor` row for the
stream against the entry at its seq (a head below the last anchor fails with `anchor`).

## Device streams and anchors

Each till keeps its own chain in `till_audit` (`@shopper/audit/sqlite`). It uploads to `POST /sync/audit`
in batches after the server's head; the server stores it in `device_audit` only when the batch continues
the stored head (contiguous `chain_seq`, matching `prev_hash`) and every `hashEntry` matches. A gap, fork,
forged hash or another device's rows is rejected and audited as `device.audit.rejected`, and the till stops
sending. The upload itself is a `device.audit.upload` command, so the org chain records each device head.

Once a day the one watchdog starts an `audit.anchor` workflow per org (instance `anchor-{orgId}-{day}`). It
writes one `audit_anchor` row per stream (the org head before its own row, and each device head) and emails
the heads to each protected owner. A day the watchdog misses has no anchor; the next day's covers it.

## Retention

`audit_log`, `device_audit` and `audit_anchor` are append-only (triggers reject update, delete and
truncate). Nothing purges them: the six-year retention is a floor, not a deletion schedule.

The forward migration preserves existing Day 2 rows: their chain fields remain
null. The verifier explicitly reports `legacy-unhashed` at those rows. New rows
start a chain at sequence 1; no historical audit data is rewritten or presented
as retrospectively authenticated.

An optional workflow checkpoint writes `workflow_run`, the business rows,
`workflow_step`'s JSON result and the audit row atomically. The instance id must
be the business key. Repeating the same org/instance/step replays its saved result
without executing the command or emitting another audit entry. Failed transactions
leave no checkpoint. This protects the crash window between a committed database
transaction and an engine checkpoint. Keep external side effects outside the
transaction and use the partner's idempotency key.

Ordinary commands may supply a read-only `replay(tx, context, input)` hook. It runs under
the existing tenant advisory lock and returns `{ output }` for an identical persisted result,
or `undefined` to execute the mutation and audit. A replay must check identity/content/scope
and never write. Workflow commands continue to use their existing checkpoint replay.

## Registration scope

`defineCommand({ scope: "registration" })` is a trusted, definition-level choice (the default is the
customer tenant). It appends to `registration_audit_log` and checkpoints to
`registration_workflow_run`/`_step`, with the same locking, redaction and v1 hash as the customer chain;
`verifyChain` verifies either. The context may carry only `orgId` (the reserved candidate id) and
`appVersion`; actor, device, role, approver, branch, reason and device time are rejected. The command
inserts the registration request in `run`, before the audit row. Registration commands may run inside an
outer transaction with customer commands (Drizzle savepoints) under the same candidate lock. Never return
secrets from a command: workflow outputs are stored as given.

`@shopper/core` re-exports this wrapper for compatibility with provisioning code.

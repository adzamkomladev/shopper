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
Daily anchors and the audit viewer are scheduled for later days.

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

`@shopper/core` re-exports this wrapper for compatibility with provisioning code.

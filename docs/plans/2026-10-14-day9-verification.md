# Day 9 verification

This evidence accompanies the [approved plan](2026-10-14-day9-sync-pull.md) and
[handoff](2026-10-14-day9-codex-handoff.md). Day 9 implementation and local acceptance passed. The pushed branch’s CI result and
completion remarks are recorded on the Day 9 Notion page after CI passes.

## Acceptance evidence

| Behaviour              | Evidence                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Durable change feed    | Store-scoped contiguous bigint sequences, cursor validation, 500-row pages, deletes and unknown-version halt; existing feed slices preserved.                                                                                                                                                                                                          |
| Bootstrap              | Repeatable-read snapshot pins reference data and cursor together; gzip stored through Blobs on R2 and box filesystem; atomic audited SQLite replace followed by tail pull; empty stores initialize once.                                                                                                                                               |
| Realtime               | Authenticated header credentials and principal-derived scope; sequence-only nudges; Cloudflare StoreHub hibernation and actual Bun WebSocket path share the Realtime port. A failed or hung socket falls back from 30 seconds to a capped 5-minute interval and reconnects; a healthy idle socket catches up every five minutes to repair lost nudges. |
| Commit visibility      | Catalogue notifications run after the audited transaction commits; rollback emits nothing. Scheduled prices commit and publish in separate checkpointed steps so a failed notification retries the same envelope.                                                                                                                                      |
| Receipt numbering      | Audited, locked issuance of two nonoverlapping 1,000-number blocks; consumed high-water mark survives stale concurrent requests; normal and X overflow counters commit with the sale and outbox. Enrollment supplies codes for immediate offline sales.                                                                                                |
| Time and compatibility | Raw device time retained, corrected/clamped occurrence time used for historical authority and tax, returned in acknowledgment and saved locally. Sale v1 upcasts before hashing. Transport protocol 2 adds metadata; protocol 1 retains its strict legacy response shapes.                                                                             |
| Host recovery          | Real separate-process SQLite writer lock and all three SIGKILL windows pass; independent fresh tills enroll distinct devices while restarting a till retains its identity.                                                                                                                                                                             |
| Status UI              | Real host bridge supplies live/polling/offline, cursor/head, last pull, pending sales and receipt capacity. All eight planned states covered at 1366×768, 1440×900 and 390×844 with axe, overflow checks and keyboard Y.                                                                                                                               |
| Offline-hour gate      | Injected one-hour outage, 2,001 sales including receipt exhaustion and X overflow, server catalogue changes, then exact reference/payload/hash/time/sequence/receipt/cursor reconciliation and duplicate-free replay.                                                                                                                                  |

## Final local gates

| Command                   | Result                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `vp check`                | Passed; no warnings, lint errors or type errors in 559 files.                      |
| `vp run guard`            | Passed.                                                                            |
| `vp test --run`           | Passed; 324 tests in 92 files, 22.2 minutes.                                       |
| Offline-hour gate alone   | Passed; one test, 266.82 seconds.                                                  |
| Review-fix suites         | Passed; 11 tests in two files.                                                     |
| `vp exec playwright test` | Passed; 153 tests, 29.1 minutes, including seven new status tests and 24 captures. |
| Public browser suite      | Passed; 28 tests, 5.7 minutes, with separate output preserving status captures.    |
| `vp run build`            | Passed; all 25 tasks, including both shells and till UI/host.                      |
| `vp run typecheck`        | Passed.                                                                            |

## Review

The UI review found a sync detail typography mismatch against Figma node 57:4800;
its size, weight and line height now match the reference. The Day 8 Alert/StatusBadge
patterns are retained as required by the approved plan. The final UI reviewer inspected all 24 fresh
captures and the running app with Playwright MCP: typography computes to 12px/20px/500,
focus is visible, Y triggers a pull, and reduced motion has no active animations. Verdict: ship.

Compatibility validation found that adding fields to protocol 1 would break the strict
Day 8 parsers. A real legacy-parser regression test failed before the transport was
advanced to protocol 2 and the old response shapes restored.

The full suite caught an eager `hono/bun` import in the box entry, which evaluated
Bun-only SSG code when Node imported the shared app. The entry now loads this adapter
only in Bun; both real Node API and real Bun server paths pass together (three tests).
The schema inventory assertion now includes `receipt_block` and its tenant foreign key.

Code review also found malformed snapshot heads could poison bridge status, and a lost nudge
could leave a healthy idle socket stale indefinitely. Both were reproduced with failing real
HTTP/WebSocket regressions, then fixed with shared sequence validation and a five-minute
catch-up pull. Both affected suites pass together (11 tests).

The required Codex review found that Workers would gzip the already-compressed snapshot again
at the external HTTP boundary. A real Wrangler HTTP regression reproduced a 200 response whose
body still contained gzip bytes after fetch decoded one layer. The Cloudflare adapter now returns
precompressed responses with `encodeBody: "manual"`, as required by the
[Workers Response contract](https://developers.cloudflare.com/workers/runtime-apis/response/#the-encodebody-option).
The regression passes; unencoded responses, including live upgrades, retain their original Response.

Receipt acknowledgment initially audited an absent clock offset as `undefined`, which
canonical JSON rejects. The failing gate reproduced it; absent optional fields are now
omitted. Request byte-budget coverage includes the receipt cursor. Restart coverage
also caught fixture identity reuse and a lock held in the wrong recovery phase; the
fixtures now preserve the intended real server-commit/client-ack interruption.

The full run exposed a four-minute wall-time limit on the 2,001-sale gate under concurrent
validation load. The fixture budget is now ten minutes; the injected one-hour outage and
every exact reconciliation assertion are unchanged. The isolated gate passed in 266.82 seconds; the subsequent complete suite also passed.

The final Codex CLI review rerun completed on `gpt-6.1-sol` with medium effort.
It found no remaining compression defect. Its two retained-data findings—backfilling existing
branch/device codes and upgrading previously stored v1 sale hashes/times—are excluded by the
explicit disposable-data/no-backfill decision in the handoff. Incoming v1 events remain covered
by upcasting and replay tests. No confirmed finding remains within the approved scope.

## Resets and boundaries

Only disposable Postgres integration fixture databases, Playwright E2E databases and
host temporary SQLite files were created/reset. No customer database was reset. Local
captures are ignored under `.shopper/day9/screenshots`; CI preserves browser captures
in its `playwright-results` artifact.

The approved Rivet decision is unchanged: the box uses one shared in-process hub now;
the Rivet StoreHub actor moves behind the same port on day 36. `store_change` pruning
and Electron IPC remain deferred. Snapshot compression uses a stream but buffers the
compressed result because the current Blobs port accepts `Uint8Array`; change the port
and both conformance implementations if catalogue scale requires streamed uploads.

Existing PostgreSQL rows and till SQLite files remain disposable, as approved in the handoff.
Reset/reseed existing disposable PostgreSQL databases and use fresh till files before Day 9 use.
Retaining pre-Day 9 PostgreSQL data requires separate code-backfill and stored-sale upgrade migrations
before any production rollout. Re-enroll a register when resetting its receipt counters; preserve
the same file and identity for an ordinary restart. No production release or hardware test is part of Day 9.
The pushed PR, CI results, preserved commit links and completion remarks are recorded
on the Day 9 Notion page after CI succeeds.

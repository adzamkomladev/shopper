# Day 8 verification

This evidence accompanies the [approved plan](2026-10-13-day8-till-sync-push.md).
Day 8 implementation and local acceptance passed. The pushed branch’s CI result and
completion remarks are recorded on the Day 8 Notion page after CI passes.

## Acceptance evidence

| Behaviour             | Evidence already verified                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local durability      | Real on-disk Node SQLite; sale, lines, counter, outbox, private session proof and audit commit together; injected failures roll back; reopening preserves committed records.                                                                                                                                                                                              |
| Money and tax         | Golden dated Ghana tax snapshots use integer money and quantity arithmetic. Server acceptance preserves captured product, price and tax snapshots, including a later product tax-class change.                                                                                                                                                                            |
| Exactly-once upload   | 5,000 sales, 25 logical batches, 75 HTTP push requests: initial delivery plus two replays of every batch. Batches contain at most 200 events and at most 1 MiB including proofs. PostgreSQL contains 5,000 unique store sequences, 5,000 acceptance audits and 5,000 assignment audits; local sales remain and outbox rows are gone.                                      |
| Volume duration       | The final integrated volume case passed in 1,045.45 seconds; its measured recording/upload window was 940.59 seconds. The prior host-slice case took 667.81 seconds, with a 619.58-second recording/upload window. These are observations, not performance thresholds.                                                                                                    |
| Crash recovery        | Actual compiled child host receives SIGKILL after acceptance before sequencing, after sequencing before response, and after response before local acknowledgment. Restarting the same SQLite file produces one sale, sequence and each server audit, retains the local sale, and clears the acknowledged outbox row.                                                      |
| Acknowledgment safety | Partial acknowledgment removes only accepted submitted IDs. Unknown, duplicate, mismatched, malformed and out-of-range sequence responses remove nothing. Timeout, 429, server failure and lost response retain records with durable retry state.                                                                                                                         |
| Authentication        | Device-authenticated uploads survive cashier-session expiry. Revoked devices, forged historical session relationships and cross-tenant references are rejected. Original issuance permissions and recording windows are validated; credentials travel separately from sale events.                                                                                        |
| Adapter parity        | Both adapters call the shared audited assignment command. Real workerd and box conformance cover first-assignment concurrency, replay, reopening, scope rejection and rollback after audit failure.                                                                                                                                                                       |
| Versions              | Published protocol/event version is 1. No protocol 0 is accepted. Independent N=2/N=1 negotiation fixtures and producer-owned event dispatch/upcasting fixtures verify the forward compatibility policy; the original application version is retained.                                                                                                                    |
| Host transports       | Real WebSockets and child-process IPC use one correlated Valibot dispatcher. Loopback binding, allowed Origins and a per-start capability protect the browser bridge; browser sale recording is forbidden.                                                                                                                                                                |
| Connection screen     | Eight required states, distinct host/server connection, keyboard C/R/A, About focus restoration, malformed status handling, axe checks and three viewport sizes. Figma review found and fixed raw blocked-sale wording, mobile badge wrapping and the focused-page outline. Final connection suite passed all 16 tests; all 24 state/viewport screenshots were refreshed. |

## Review corrections

Confirmed regressions were reproduced before their fixes: mixed-case cashier identity corrupted
audit verification; changed product tax classification prevented acceptance of a valid captured
snapshot; duplicate sale-line identity was returned as a transient server failure; unsupported
discounts were accepted; N−1 negotiation returned the wrong protocol; an out-of-range server
sequence could reach SQLite; an idle host skipped reconnect backoff; host shutdown could race a
final database read; invalid browser timestamps could throw during rendering; and an empty
upstream application version could permit upload without a valid handshake; and losing parent IPC
during host startup could cause an uncaught transport error instead of closing the host.

The Codex CLI review quota was exhausted until October 19. Reviews use the repository's documented
manual fallback with the `gpt-6.1-sol` reviewer, plus a dedicated screenshot reviewer for the UI.
All confirmed findings were fixed and reviewed again. The final code review also confirmed the initialized-resource invariant in the connection fixture. The reconnect status regression was reproduced and fixed: both connections show Connecting
while the configured identity and pending sale count remain visible.

## Data resets and remaining scope

Only disposable local test PostgreSQL databases, E2E databases and temporary SQLite files were
reset. No deployed database, Durable Object or KV resource has been modified.

Day 9 retains automatic reference bootstrap, pull and realtime; Day 10 retains checkout; Day 11
retains tenders. Day 8 records immutable sale snapshots without claiming payment settlement.
Development SQLite remains unencrypted until the agreed native-driver work. Recording time is
device-reported; server acceptance time is separate. Electron wiring remains later work.

## Reviewed progress commits

Progress commits stayed local until implementation, documentation, acceptance and review finished:

- `35ce38c` — audited till storage.
- `f6bbc09` — local sale snapshots.
- `6130a54` — device-authenticated, replay-safe server ingest and both sequencing adapters.
- `fd6b4cf` — reliable till push, acknowledgment validation, retry state and compatibility.
- `3c641af` — runnable host, private IPC, WebSocket bridge and actual crash recovery.
- `1e6ef43` — register connection screen, browser coverage and root-only MCP launcher fix.

Server ingest passed 222 integration tests in 62 files, push passed 252 in 69, and the final
host slice passed 263 in 73. Each also passed formatting, lint, types, guard, standalone workerd,
main/public browser tests and build. The final integrated results below include the connection
screen and documentation. Test-first fixes and dedicated code/UI review left no confirmed finding
open. A stale local dependency installation was repaired; frozen-lockfile installation passed.

## Final local gates

| Command                                                                                     | Result                                                                                                                           |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `vp check`                                                                                  | Passed; zero lint/type errors or warnings.                                                                                       |
| `vp run guard`                                                                              | Passed.                                                                                                                          |
| `vp test --run`                                                                             | 263 tests in 73 files passed; 1,631.82 seconds wall. Includes volume/replay, 11 host tests and all three actual SIGKILL windows. |
| `vp -C tooling/worker-tests exec vitest run`                                                | 20 tests in four files passed; 39.51 seconds wall.                                                                               |
| `vp run e2e`                                                                                | 146 tests passed; 1,257.25 seconds wall. Includes all 16 till connection cases and 24 screenshots.                               |
| `vp exec playwright test --config playwright.public.config.ts --output test-results/public` | 28 tests passed; 375.07 seconds wall. Separate output preserves the connection captures.                                         |
| `vp run build`                                                                              | 25 tasks passed; 25.24 seconds wall.                                                                                             |
| `vp run typecheck`                                                                          | Passed; 6.10 seconds wall.                                                                                                       |

The focused connection suite also passed all 16 tests in 192.71 seconds. A dedicated UI reviewer
inspected all 24 fresh captures against Figma at 1366×768, 1440×900 and 390×844. Mobile screenshots
are full-page captures taken at the requested viewport, including the scrollable content.

CI runs the full integration and browser suites, preserves screenshots in the `playwright-results`
artifact, and has execution deadlines sized for the real volume/replay tests. The evidence document
records local acceptance before pushing; the CI run link, all progress commit links and completion
remarks are appended to the [Day 8 Notion page](https://app.notion.com/p/3eba2c999ce981018523cb6a95fef4f3)
after CI is green. The page update is read back to verify its checked tasks and Done status.

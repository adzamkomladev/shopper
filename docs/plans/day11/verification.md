# Day 11 verification

Owner-requested checkpoint: implementation and review fixes are saved before continuing. Final
verification remains pending; this document does not claim merge readiness.

Branch: `claude/jolly-mendel-4y1tqn`. Verification uses the isolated
`/root/work/Shopper-day11` worktree and local PostgreSQL 18. The original checkout and its
unrelated changes are preserved.

## Integration evidence

The suite was run in partitions. There is no claim of a single successful local full-suite run.

| Check                                                                              | Result                                                |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Original 5,000-sale bounded upload/replay                                          | 1/1; 25m25.84s within the unchanged 30-minute budget  |
| Remaining integration suite, first complete run                                    | 614 passed, 13 failed, 3 skipped; 152 files           |
| Fresh push/host/search/payment/protocol/auth/session/guard rerun                   | 29/30; only large-basket upload remained              |
| Fresh actual workerd and portal-build integrations                                 | 2/2                                                   |
| Final unchanged large-basket push and historical/tamper regressions                | 10/10                                                 |
| Golden trading day through SQLite completion and authenticated HTTP push           | 22/22                                                 |
| Affected terminal-tender/completion/golden suites                                  | 33/33                                                 |
| MoMo shared conformance on box                                                     | 5/5                                                   |
| MoMo shared conformance on actual Cloudflare Workflows                             | 5/5                                                   |
| Live Paystack test sandbox                                                         | 3/3                                                   |
| Local payment monotonicity, payment attachment and real HTTP host regressions      | 13/13                                                 |
| Till harness browser checks before final scan-queue regression                     | 20/20                                                 |
| Real-host browser suite, including delayed-save and delayed-completion regressions | 3/3; 51.0s / 31.3s / 29.5s with unchanged 60s budgets |

The first integration failures were investigated and cleared by fresh runs: obsolete protocol
and workflow-count expectations, modules cached while source changed, a guard snapshot during
UI moves, cold timing, historical tax-class handling and repeated database reference reads in
large baskets. The upload optimization retains every per-line validation and scopes its map to
one transaction; measured HTTP upload time fell from 25,854 ms to 13,162 ms. No workload or timing
budget was reduced or increased.

The volume replay checks 5,000 unique sales, lines, acceptance and sequencing audit rows and store
sequences; 25 bounded batches produce 75 attempts with two intentional lost replies each. It
also checks exact replay payloads and the empty outbox.

Local failed/expired states retain their terminal status and reason against delayed pending/OTP
replies. Confirmed remains irreversible; late confirmation can still promote a terminal attempt.
These checks use both durable payment updates and draft attachment paths.

The complete public portal suite passed 26/28 on its first resumed run. One failure was a removed
trace directory caused by another Playwright run cleaning the parent output directory; its isolated
rerun passed. The milestone also pressed the invite shortcut while role choices were loading:
the preserved trace places the key press 236 ms before that response finished. The test now waits
for the actual Invite user action before exercising the same shortcut; its fresh rerun passes.
All 28 public cases are therefore covered, with isolated artifact directories.

Review-fix backend checks: full-phone identity and migrations pass 18/18; the new six-case MoMo
conformance suite passes on box (44.61s) and actual Cloudflare Workflows (67.29s). The final host
acknowledgement, retry-identity and same-status OTP-error suites pass 9/9 (62.46s across three files).
Scoped checks pass without warnings or type/lint errors. Backend validation is held while the
real-host UI regressions run, so their fixed timing budgets are not distorted by concurrent builds.

## UI evidence

Figma frames: `99:1973`, `48:1465`, `133:863`, `133:956`, `135:1934` in file
`4MtEIWv8yBUBYgkrk4ubPk`. Desktop and mobile screenshots are local verification artifacts under
`/root/work/Shopper/.playwright-mcp/` (ignored, not shipped). They cover the sale/tender view,
held sales, receipt completion, purchases and purchase detail. The final mobile detail screenshot
is `day11-purchase-detail-fixed-mobile.png`.

Keyboard, touch targets, receipt locking, permissions, amount reset, held-sale void reasons and
accessibility are exercised in browser tests. Read-only purchases deliberately omit printing
and returns, which belong to later days.

## Final gates

- `vp check`: all 1,062 files formatted; 866 lint/type-checked files, zero warnings or errors.
- `vp run guard`: all repository rules pass.
- `vp run -r --no-cache --concurrency-limit 1 build`: all 27 projects pass. The direct recursive
  command avoids Vite+ cache discovery treating the linked worktree `.git` file as a directory.
- `vp run typecheck`: passes.

The first independent formal review used GPT-6.1 Sol at medium effort over the complete branch
against `origin/main`, including tracked and untracked work. It found two backend issues (delayed
MoMo acknowledgements and full-phone retry identity) and six UI issues (approval validation,
transition locking, hidden receipt shortcuts, dialog focus, visible detail failures and stale
detail replies). The approval finding also exposed an unresolved waiter on fatal host replies.
All findings were checked against the connected code; fixes and regression checks are in progress.

The complete browser suites, review follow-up, PR/CI/merge and staging deployment remain in
progress. Results will be recorded here after they actually complete.

## Staging build configuration

The existing `cf` OAuth login was used to update both staging Workers Builds triggers. They watch
`main`, use the documented app build/deploy scripts and scoped paths, and retain their existing
repository and build-token identities. Build secrets were installed without exposing values,
including the existing Paystack test secret and the edge direct migration database URL.
No production deployment is part of Day 11. The first staging build and deployed smoke checks
are pending.

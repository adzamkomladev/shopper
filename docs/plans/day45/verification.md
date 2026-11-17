# Day 45 verification

Run locally on 17 Nov 2026 on a shared machine (load average 6–10 from other containers, no display, no
fonts). CI on clean runners is the gate; the PR's run is linked from the Notion page.

| Check                                      | Result                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `vp check`                                 | clean                                                                                        |
| `vp run guard`                             | clean                                                                                        |
| `tests/integration/release/guides.test.ts` | 3 passed; fails on a deliberately broken link (`boxx.md`), passes once restored              |
| Integration, all projects (both adapters)  | 2082 passed, 15 failed, 21 skipped (504 files); re-run of the 14 failing files: 7 still fail |
| Browser (`playwright test`)                | 1054 passed, 30 failed (4.8 h)                                                               |
| Public browser config                      | 33 passed                                                                                    |
| Codex review (`gpt-6.1-sol`)               | no actionable findings                                                                       |

## The local failures

None touch the change: Day 45 edits docs, the root `package.json` version and one docs test, and no
`.ts`/`.tsx` outside that test.

- Integration, still failing on re-run: timeouts in `sync/push`, `sync/volume`, `sync/chaos/replay` and
  `edge/worker.test.ts` (FiscalLane in workerd, 5 s); `sync/bun/live` at 1323 ms against 1000 ms;
  `hardware/render/equivalence` (pixel diff 0.052 against 0.0175, no fonts); `till/crash` (Sentry event
  not seen). `crash` and `equivalence` fail the same way with the version put back to 0.1.1.
- Browser: 30 timing failures spread across till-ui settings, sale, shift and status, portal stock takes,
  tax fiscal, mobile navigation and shop pay, all from a 4.8 h run on the loaded machine.

## Not checked here

Real shop hardware, the till pilot → stable promotion (after the pilot shop runs the build), and the
production release runs, which wait for owner approval in GitHub.

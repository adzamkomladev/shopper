# Day 47 verification

Run locally on 18 Nov 2026 on a shared machine. Other projects' containers restart on it every few minutes. CI on
clean runners is the gate for the full integration and e2e suites; the PR's run is linked from the Notion page.

| Check                                                                                 | Result                                                          |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `vp check`                                                                            | 0 errors (57 warnings, all pre-existing)                        |
| `vp run guard`                                                                        | clean                                                           |
| `tests/integration/relay/*` (publish, publisher, lock, auth, enrol)                   | 19 passed before review fixes; publisher (5) re-run green after |
| `tests/integration/catalogue/online.test.ts`                                          | 2 passed, before and after review fixes                         |
| `tests/integration/tax/schema` (table list, `org_id` count)                           | 3 passed                                                        |
| `tests/integration/security/tenant/sweep.test.ts` (`PUT /settings/online` body added) | timed out locally (900 s); CI runs it                           |
| `tests/e2e/portal/settings/online.spec.ts`                                            | categories test passed at 1920, 1440, 1366, 768, 390; see below |

## Tests that bite

Each was watched failing:

- `publisher.test.ts` snapshot then 100 deltas: with the `onlineVisible: false` re-send of withdrawn products
  removed, the relay keeps hidden and archived products and the projections differ.
- `publisher.test.ts` allowlist: with `supplierId` added to the projection, the forbidden-field check fails.
- `publisher.test.ts` switch: with switching on deleting `relay_published` (the pre-review code), a product hidden
  while the switch was off stays on the relay and the projections differ.
- `publisher.test.ts` hashing: when `sha256` was not awaited every row looked changed, and "a third run sends
  nothing" failed.

## Codex review (`gpt-6.1-sol`, base `main`)

| Finding                                                                                         | Verdict | Fix                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 Switching on deleted the published hashes, so products hidden meanwhile were never withdrawn | Real    | Switching on marks the hashes stale (`hash = ''`): everything is re-sent and withdrawals still found                                                                                                    |
| P2 The settings page never refreshed after the first publish                                    | Real    | `/settings/online` is re-read every 5 s while it says "Sending" (on, not yet published, no error)                                                                                                       |
| P2 The Publisher did not update `workflow_run`                                                  | Real    | `relay.published` / `relay.failed` upsert `workflow_run` (completed, waiting, failed) in their transaction. Not a step checkpoint: a loop reuses step names, so a saved step would replay an old answer |

## Screenshots

`screenshots/settings-online-categories-{1920,1440,1366,768,390}.png`: a hidden department with its category
switched on but "Hidden with its department". At 390 px the note was cut off and now wraps under the name.

## Not verified here

- The e2e box-switch and empty-state tests: on this machine Chromium aborted requests with `ERR_NETWORK_CHANGED`
  each time a neighbouring container restarted, and the portal sign-in setup timed out on one run. CI runs them.
- A real box against the real cloud: the publisher tests drive the real box adapter against the real relay routes
  in one process, with the licence signing from Day 46.
- Figma: the file has no online-store frame; the page follows the shipped settings pages and `@shopper/ui`.

## Remarks

- The plan's "waiting count" on the status line was dropped: the page shows on/off, the last publish time and the
  last error, which is what an owner acts on.
- Every `/settings/*` page highlights "Loyalty" in the sidebar (existing behaviour); Online store is reached from
  the settings tabs.
- The store answers with `max-age=60`, so "within seconds" holds at the origin; shoppers behind the edge cache may
  wait up to a minute.
- The box trusts its own hash table. A relay that lost its copy is repaired by switching Online Orders off and on.
- While the relay is unreachable the Publisher retries from 60 s, doubling to 15 min; a catalogue write wakes it
  sooner.
- A catalogue import that finishes in its workflow does not wake the Publisher; the next catalogue write or a box
  restart publishes it.

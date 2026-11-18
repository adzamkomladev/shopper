# Day 46 verification

Run locally on 18 Nov 2026 on a shared machine (load average 30–60 from other containers). CI on clean runners is the
gate for the full suites; the PR's run is linked from the Notion page.

| Check                                                                                                                                | Result                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `vp check`                                                                                                                           | 0 errors (57 warnings, all pre-existing)                                                  |
| `vp run guard`                                                                                                                       | clean                                                                                     |
| `tests/integration/relay/*` (lock, auth, enrol, publish)                                                                             | 14 passed                                                                                 |
| Affected suites: tenant sweep, billing dunning, licence, migration/onprem, platform, catalogue products, export coverage, tax schema | 60 passed (16 files) before review fixes; relay files re-run green after them             |
| `tests/e2e/portal/relay/banner.spec.ts` against the real box API and portal build                                                    | 2 passed; axe and horizontal-overflow checks at 1920, 1440, 1366, 768, 390; console clean |

## Tests that bite

Each was watched failing before its fix:

- `lock.test.ts`: failed before migration 0047 (writes went through), passes with the trigger.
- `auth.test.ts` replay: with the nonce check disabled, the replay test fails; with the signature hashed as sent
  instead of canonically decoded, the re-spelled (`==`, tab) replay test fails.
- `auth.test.ts`, `enrol.test.ts`, `publish.test.ts`: written before `@shopper/core/relay` existed.

## Codex review (`gpt-6.1-sol`, base `main`)

| Finding                                                                                         | Verdict | Fix                                                                   |
| ----------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| P1 Replay bypass: Base64 decoder accepts padding/whitespace, so a re-spelled signature is "new" | Real    | Nonce = SHA-256 of the canonical re-encoding of the decoded signature |
| P1 Org-wide inbox cursor skips orders: `inbox_cursor` is numbered per store                     | Real    | `/relay/orders` takes `store` and pages that store's cursor only      |

## Not verified here

- The full integration and e2e suites (CI runs them).
- A real box: the Publisher and Order-inbox actors that call these routes are Days 47 and 50.
- The portal still shows edit buttons on a relay org; a click gets the 423 message. Hiding them is UI polish for Day
  53's relay health page.

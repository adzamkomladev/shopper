# Day 28 · Verification

## Automated

- `vp check`: 0 errors (29 warnings, the existing baseline). `vp run guard`: clean.
- Till UI e2e after the shell move: every till spec except `serial.spec.ts` passes. The keypad regression run
  (checkout, customers, accounts, sale, tender) is 178/178.
- Portal shell and theme (`tests/e2e/portal/shell/{sidebar,search,skeleton}.spec.ts`, `theme.spec.ts`): green.
- S0: `compareVersions` (`rc.9 < rc.10`, a leading `v`, `+build`) and "a ready update stays ready when the shop moves
  to a channel with nothing newer" were red before the fix and green after.
- Shell runs at 1920, 1366, 1024 (till), 768 and 390 in light and dark: till shell 13/13 light and 5/5 dark,
  portal sizes 7/7 dark, shell skeleton 6/6 (the skeleton's header lands within 2 px of the loaded one).
- Admin e2e: `channel.spec.ts` (not run on Day 27) and `kyb.spec.ts` pass. KYB failed once while the integration
  suite ran beside it (the approve request was still pending at the 5 s check) and passed alone.
- Integration: S1 (`system/ready`), S2 (`tooling/cloudflare/{stage,deploy,smoke}`), S4 (`tooling/backup/verify`),
  U5 (`till/host/session/truth`) and the 125% receipt render pass. The full local run stopped at its 50-minute
  cap with two failures reported, both Windows-only test bugs fixed on this branch (`till/host/enrol` deleted the
  database before the host exited; `sync/bun/live` built a path from a URL pathname). CI runs the full suite.

## Tender latency (U6)

`tests/e2e/till/ui/tender/latency.spec.ts` types into the amount box of a production build of the till harness on a
4x slower CPU and times each digit to the next painted frame.

| Build                                       | Worst digit |
| ------------------------------------------- | ----------- |
| Dev server, before                          | 183 ms      |
| Dev server, React Compiler                  | ~125 ms     |
| Production build, trace off                 | 52–63 ms    |
| Production build, keypad split and memoized | ~40 ms      |

The pad no longer repaints on a typed digit. The median digit is about 40 ms. The budget is 50 ms, and the worst
digit still crosses it on some runs: four repeats gave 2 passed and 2 failed (47 / 65.5 / 44.5 ms and
50.6 / 9.5 / 39.9 ms). The slow digit is the first one or scheduler noise. The owner kept the 50 ms budget, so the
spec stays strict until the first digit is faster.

## Not verified here

- `tests/e2e/till/ui/serial.spec.ts` needs a python3 pty and does not run on Windows (unchanged by this branch). CI
  runs it.
- The till's enrolment now writes the device token and database key to the secret store
  (`apps/till/electron/src/main.ts`). No test covers it.
- S3 (production on `shopper-api.temtem.dev`, `shopper.temtem.dev`, `shopper-admin.temtem.dev`) needs the owner's
  Cloudflare login (`vp exec cf auth login` in `apps/edge`).
- Codex was out of quota (resets 4 Nov), so the Day 27 review and the pre-merge review ran with `/code-review`.

## Day 27 review

Fixed: `compareVersions` returned `NaN` on a leading `v` or build suffix, prerelease parts compared as text, the
updater dropped a downloaded update when the feed later said "nothing newer" or offered the same version, and
enrolment did not keep its secrets.

Left: `update.check` does not check the session (low; the host only answers its own window), each handshake reads
the org once more, and the channel audit row has no before/after.

## Screenshots

`screenshots/portal-products-<width>-<scheme>.png` and `portal-products-rail-<width>-<scheme>.png` at 1920, 1366,
1024, 768 and 390; `till-shell-<size>-<scheme>.png` for the till shell.

## CI follow-ups

- Sidebar sections now start open, so every page a member may use is in view and the many portal specs that click a
  sidebar link by name work without opening its section first. A section still collapses on a click.
- The Inventory link is back as one entry (`/stock`, also current on `/suppliers`); the Inventory page's own tabs
  reach records, takes, valuation and suppliers.
- Transaction lines size their columns to the card with container queries, not the viewport.

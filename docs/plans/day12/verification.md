# Day 12 verification

Branch: `claude/day12-hardware-receipts`, from `origin/main` at `c38c883`. All runs were local and serial, on
Ubuntu with PostgreSQL 18, Rivet, RustFS and the virtual printer from `vp run services:up`.

## Gates

| Check                                                           | Result                                                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `vp check`                                                      | 0 errors (warnings come only from untracked `apps/*/.cloudflare` build output)                                    |
| `vp run guard`                                                  | clean                                                                                                             |
| `tsc -b --force`                                                | clean                                                                                                             |
| `vp run build`                                                  | green                                                                                                             |
| `vp test --run` (full integration, including the workerd suite) | 709 passed, 3 skipped, 4 failed. All four fixed in `22899a0`, then re-run green (23/23 across the affected files) |
| `vp run e2e` (portal and till-ui)                               | 308 passed, 4 failed (role matrix permission count 29 → 30, fixed); `matrix.spec.ts` re-run 14/14                 |
| `playwright.public.config.ts`                                   | 28/28                                                                                                             |
| `playwright.connection.config.ts` (till-ui)                     | 160/160                                                                                                           |

## Day 12 evidence

| Area                                                                                      | Result                                                                                      |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ESC/POS profiles, transliteration, injection, network driver                              | `tests/integration/hardware/printing/{profiles,network}` green                              |
| Sale prints on the virtual printer (decoded text, QR payload, drawer kick only with cash) | `printing/{sale,drawer,concurrency,failure,settings}` green                                 |
| Renderer conformance                                                                      | box 7/7, workerd (Chromium stand-in for Browser Run) 7/7, Electron under xvfb 6/6           |
| Electron vs in-binary image equivalence (golden 80 mm receipt)                            | both 576 px wide, Δheight 0, 1.16% pixels differ (limit 1.75%); 40-line receipt not clamped |
| Till PDF stored and uploaded to RustFS, rejects, retry, crash recovery                    | `till/host/receipts/*`, `sync/receipts/*` green                                             |
| Settings, reprint, preview, completion print status                                       | e2e specs inside the 160/160 till-ui run, plus ui-reviewer passes                           |

## Not verified

- No real printer, USB or serial hardware, and no Windows machine. These are Day 13 work.
- No live Browser Run call; the `BROWSER` binding needs Browser Run enabled on the account.
- No live R2 upload. Owner action: create the `shopper-receipts-dev` and `shopper-receipts-staging`
  buckets and a scoped token, then set `SHOPPER_S3_RECEIPTS_BUCKET`.
- No deployment.
- Codex was unavailable. Every slice was reviewed by hand by the reviewer agent, and UI slices also by the
  ui-reviewer agent.

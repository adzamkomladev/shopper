# Day 28 · UI overhaul and pilot readiness

**Done when:** the portal, admin and till share one sidebar shell and theme, the till never clips at Windows'
scaling, a signed-out session shows as signed out, the tender amount answers at once, and the cloud has a
production stage that is deployed, probed and restorable.

## Slices

| Slice | What                                                                                                                                           | Tests first                                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| U1    | Proportions (h-9 controls, h-8 page titles), theme tokens, the shimmer skeleton, the tick on totals and the drawn check on a completed sale    | the shell and screen specs below                                                                                                      |
| U2    | One `Sidebar` in `@shopper/ui` (rail, sheet on phones, tooltips, `Ctrl+B`/`Ctrl+M`, remembered per app, `touch` sizing)                        | `tests/e2e/portal/shell/sidebar.spec.ts`                                                                                              |
| U3    | Portal and admin shells on it, a header with the page name and search, the theme menu, `Kbd` chips removed                                     | `tests/e2e/portal/shell/{sidebar,search,skeleton}.spec.ts`, `tests/e2e/portal/theme.spec.ts`                                          |
| U4    | Till shell on the sidebar (starts as a rail), the Help registry (`F1`, `Ctrl+/`), no clipping at 125%, the receipt render at any Windows scale | `tests/e2e/till/ui/shell/{screen,help,overflow,theme}.spec.ts`, `tests/integration/hardware/render/electron.test.ts` (125%)           |
| U5    | Session truth: an expired or refused session publishes a status with no user, and the till says "Your session ended"                           | `tests/integration/till/host/session/truth.test.ts`, `tests/e2e/till/ui/signin/live.spec.ts`                                          |
| U6    | Tender amount: digits show in the next frame on a 4x slower CPU, nothing reaches the host before Charge                                        | `tests/e2e/till/ui/tender/latency.spec.ts`                                                                                            |
| U7    | Quirks sweep and screenshots                                                                                                                   | `screenshots/`                                                                                                                        |
| S0    | Catch-up: review of Day 27, toolchain waiver re-checked                                                                                        | `tests/integration/sync/version.test.ts`, `tests/integration/till/updates.test.ts`                                                    |
| S1    | `GET /health/ready`: database, schema at this build's migration, cache; 503 with the failing check                                             | `tests/integration/system/ready.test.ts`, `tooling/worker/tests/worker.test.ts`, `tests/integration/tooling/cloudflare/smoke.test.ts` |
| S2    | Production stage (`--mode prod`), `deploy.ts --stage production [--promote]`, `Release cloud` workflow                                         | `tests/integration/tooling/cloudflare/{stage,deploy}.test.ts`                                                                         |
| S3    | Provision and deploy production on `shopper-api.temtem.dev`, `shopper.temtem.dev`, `shopper-admin.temtem.dev`                                  | smoke                                                                                                                                 |
| S4    | `tooling/backup/verify.ts`: migrations complete and every audit chain verifies on a restored copy                                              | `tests/integration/tooling/backup/verify.test.ts`                                                                                     |
| S5    | Uptime: a GitHub Actions probe on `/health/ready` every 5 minutes once `PRODUCTION_LIVE` is set                                                | workflow                                                                                                                              |
| S6    | Pilot docs: cashier, manager, cutover, rollback                                                                                                | `docs/pilot/`                                                                                                                         |

## Decisions

- **Till touch targets stay at 44 px** (`h-11`), not the plan's `h-10`: the till's touch-target check (WCAG 2.5.5)
  and the cashier's thumb both need 44. The back office uses `h-9`.
- **Production builds use `--mode prod`.** Vite's default build mode is already `production`, so a plain build
  would quietly target production; `production` mode resolves to the dev Worker on purpose.
- **Two-step production release.** `deploy:production` uploads a version without serving it; `--promote` migrates,
  deploys and smokes. No percentage split, because Durable Objects and Workflows run on one version.
- **Readiness is public and uncached** and sits before the public-path check on both hosts, so the uptime probe
  needs no token.
- **No Sentry on Workers**; uptime is the GitHub Actions probe.
- **Codex was out of quota** (resets 4 Nov), so the Day 27 review and the pre-merge review ran with `/code-review`.

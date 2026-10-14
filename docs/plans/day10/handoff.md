# Day 10 handoff (for the next agent)

Read first: `AGENTS.md`, [plan.md](plan.md) (approved plan, grounding resolutions, review exception), then the
docs AGENTS.md lists for the area you touch. Branch `codex/portal-start`. Work slice by slice: failing tests →
implement → whole integration suite → manual review → commit. **Do not push** until every slice is done.

## Status (14 Oct, end of day)

Slices 1–7 are done and pushed; see [verification.md](verification.md) for commits, results and gaps. Open:
the Codex branch review (from 21 Oct), the backoffice mapping e2e (blocked by the in-progress portal e2e
server), and the Notion Day 10 status. The sections below are the earlier hand-off, kept for history.

## Done (committed locally, not pushed)

| Commit    | Slice | What                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `53ab5cf` | 1     | PG `barcode_mapping` (migration `0014`), audited commands `packages/core/src/catalogue/mappings/`, routes `/catalogue/barcodes/mappings` (`packages/api/src/routes/catalogue/mappings.ts`), plan doc                                                                                                                                                                                                    |
| `9140498` | 2     | Feed/snapshot v2: product payloads carry `barcodes`, `barcode-mapping` entity, archive = upsert with `archivedAt`, `decodeReferenceChange`/`decodeSnapshot` with v1 upcasters (`packages/core/src/schemas/till/reference.ts`), till `KNOWN_VERSION = 2`                                                                                                                                                 |
| `c16d1ed` | 3     | Till SQLite `tillMigrations[]` + `PRAGMA user_version` (`packages/db/sqlite/src/till.ts`, runner in `packages/adapters/box/src/till/database.ts`), `till_state.reference_version` readiness (forces one snapshot), lookup tables + FTS5 (`packages/core/src/till/lookup/`): `searchCatalogue`, `lookupCode`, `projectProducts`. 20k products: p95 2.6 ms, cold 1.9 ms (node 24.21, linux-x64, AMD EPYC) |
| `d2c7aa4` | 4     | `snapshotAmount` in `@shopper/tax` (snapshotLine delegates), `quoteLine` + shared selection `packages/core/src/till/quotation.ts`, `resolveScan` `packages/core/src/till/basket/scan.ts`, provisioning accepts `barcodeMappings`                                                                                                                                                                        |

## In progress: Slice 5 (durable drafts)

Failing tests are written but **uncommitted**: `tests/integration/till/basket/drafts/*.test.ts` and
`tests/support/till/drafts.ts` (its header documents the API). 38 tests fail only with "not a function".

Implement (decisions already made):

- New migration step appended to `tillMigrations` (never edit shipped steps): `sale_draft` (UUIDv7 id,
  UNIQUE org/device/branch/cashier, `revision`, stored totals JSON for change detection, timestamps) and
  `sale_draft_line` (id, draft_id, position, product_id, quantity_thousandths, label JSON including the
  original quantity for price labels). Drizzle schema in `packages/db/sqlite/src/schemas/till/drafts.ts`.
- `packages/core/src/till/drafts/{commands,queries,quote}.ts`, Valibot in `packages/core/src/schemas/till/drafts.ts`.
  Mutations use SQLite `defineCommand` (`packages/audit/src/sqlite/command.ts`); draft rows + audit in one
  transaction; revision check inside it (`UPDATE … WHERE revision = expected`). Commands `till.draft.add|quantity|remove`.
- Reuse `resolveScan`, `quoteFrom`, `snapshotAmount`. Price-label edit: `gross = mulRatio(encodedGross, newQty, originalQty)`.
- Extract `validateSession` into `packages/core/src/till/session.ts`; `record.ts` uses it, behaviour unchanged.
- `readDraft` on a line whose product was archived or lost price/tax must not throw: return that quote line
  with `error: <TillError code>`, exclude it from totals, `changed: true`. Add one test for this in `requote.test.ts`.
- Reject `quantityThousandths` when `code` is given (`QUANTITY_INVALID`).
- Never write `local_sale`, `sale_line`, `outbox` or receipt state.
- Commit: `feat: persist audited unpaid baskets`.

## Figma work (Claude, in progress 14 Oct)

Done in Claude because OpenCode has no Figma access. Ordering changed: Slice 7 UI is built before Slices 5–6.

- Backoffice mapping screen (full CRUD on the Slice 1 API) — `packages/backoffice/src/{screens,components,queries}/catalogue/mappings/`, e2e `tests/e2e/portal/catalogue/mappings.spec.ts`. Status: building.
- Till sale screen as presentational components with a seam for Slice 6 — `apps/till/ui/src/{screens,components}/sale/`, `hooks/scanner.ts`; spec `docs/plans/day10/figma.md`; screenshots `docs/plans/day10/screenshots/`. Status: building.

## Remaining slices

- **6 Bridge** — `packages/sync/src/schemas/bridge/contracts.ts` add correlated (request id) ops: `search`,
  `readDraft`, `scan`/`add`, `setQuantity`, `removeLine`. Extract dispatch from
  `packages/adapters/box/src/till/host/runtime.ts` (175 lines) into `host/dispatch.ts`. Allow these ops on the
  capability socket in `host/transport.ts:88`; keep `recordSale`/`shutdown` trusted-only. Identity and cashier
  session come only from host config, validated with `validateSession`. Recoverable domain errors (TillError
  codes) must NOT close the socket — change both `runtime.ts` and `apps/till/ui/src/connection/store.ts:104`.
  UI: serialize mutations, reload the draft after an uncertain response/disconnect, never replay an add, drop
  stale search responses. Tests: `tests/integration/till/host/bridge/{drafts,search}.test.ts`, update
  `tests/integration/till/host/websocket.test.ts`. Commit `feat: expose basket operations through till bridge`.
- **7 Screens** — load the `ui-screen` skill. Figma file `4MtEIWv8yBUBYgkrk4ubPk`: sale frame `99:1973`
  (1366×768), cart `48:1465`, input `13:1347` (Figma MCP is now authorized). Till: `apps/till/ui/src/screens/sale/screen.tsx`,
  `components/sale/{lines,search,totals,states}.tsx`, `hooks/scanner.ts` (keys < 60 ms gap incl. Enter = scan).
  Right panel: gross, net, NHIL, GETFund, VAT, covid/rounding from the rule + "Payments are available in the next
  checkout step"; no Charge. Shortcuts F2/F3/F4/Delete/F8/Escape via `ShortcutRoot`; no `useEffect`
  (guard), use `useSyncExternalStore` and callback refs. Backoffice mapping CRUD:
  `packages/backoffice/src/{screens,components,queries}/catalogue/mappings/`, route in `routes/create.tsx`.
  E2E: `tests/e2e/till/ui/sale.spec.ts` (incl. 30 scans < 60 s, 59/60/61 ms gaps), `tests/e2e/portal/catalogue/mappings.spec.ts`.
  Screenshots at 1366×768 (till) and desktop/mobile (mapping), axe. Commit `feat: build keyboard first till sale screen`.
- **8 Completion** — full gates, Codex branch review (quota resumes 21 Oct 2026:
  `codex review --base main -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"`), write
  `docs/plans/day10/verification.md` (tests, screenshots, search timings above, resets, Day 11 remainder),
  commit `docs: record day 10 verification`, push once, check CI, then update the Notion Day 10 page
  (https://app.notion.com/3eba2c999ce981aa8eefc2b03e8d3b88): tick tasks, Status Done, remarks. State that payment,
  posted-sale completion and real peripheral validation remain scheduled.

## Commands

```sh
vp run services:up
vp run db:migrate
vp test --run tests/integration --exclude '**/volume.test.ts' --exclude '**/offline/hour.test.ts' --exclude 'tests/integration/portal/**'
vp run guard
vp check
```

`sync/volume.test.ts` and `sync/offline/hour.test.ts` take many minutes. They look hung but aren't; run them
once at the end. Run the **whole** integration suite each slice: Slice 1 broke
`tests/integration/tax/schema/tax.test.ts` unnoticed until Slice 4.

## Cautions

- The working tree has **unrelated uncommitted portal/TanStack Start work**: `apps/portal`, `apps/edge`,
  `tooling/{cloudflare,worker,build}`, `playwright*.ts`, `packages/adapters/cf`, `packages/api/package.json`,
  `packages/api/src/{portal.ts,schemas/portal.ts}`, `pnpm-lock.yaml`, `tests/{e2e,integration,support}/portal*`.
  Never stage, stash, revert or reformat them. Stage Day 10 files by explicit path. `vp check` errors in those
  files are pre-existing.
- Route paths have no hyphens (guard); never add to `PUBLISHED_ROUTES` or edit guard baselines.
- Money: integers and `@shopper/money` only. Files ≤ 250 lines (.ts) / 300 (.tsx). Barrels only re-export.
- No assistant attribution in commits. Git identity: Adzam Komla.
- Codex review is unavailable until 21 Oct; each slice gets a manual rules review before commit (approved).

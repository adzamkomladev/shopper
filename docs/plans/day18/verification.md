# Day 18 · Tax module: verification

Branch `day18-tax`, from `main` at `f903ce1`. One commit per slice.

| Slice | What                                                                   | Commit               |
| ----- | ---------------------------------------------------------------------- | -------------------- |
| 1     | Tax settings and the org-setting feed (v5)                             | `41466e5`            |
| 2     | Price mode and VAT registration in the tax engine (sale v6, refund v3) | `9e49c00`            |
| 3     | Dated tax rule editor                                                  | `589a87f`            |
| 4     | Numbered credit notes, receipt v4, fiscal payload type                 | `f67d3b3`, `ab4c124` |
| 5     | Tax summary, VAT return worksheet, Excel export                        | `116bc21`            |
| 6     | Portal Tax area                                                        | `5105387`            |
| 7     | Till lists refunds as numbered credit notes                            | `43fe609`            |
| —     | Drizzle snapshot, version pins, docs, e2e counts                       | `0038770`, `6a78cbc` |

## Notion tests

| Test                                                                        | File                                        | Broken once on purpose                             |
| --------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------- |
| A rate change dated tomorrow does not touch today's sales                   | `tests/integration/tax/rules/dated.test.ts` | Till takes the newest rule whatever its date → red |
| Credit note reverses tax exactly                                            | `tests/integration/tax/credit/note.test.ts` | Credit note without its number → red               |
| VAT return worksheet equals the sum of line snapshots for the fixture month | `tests/integration/tax/worksheet.test.ts`   | Worksheet window widened to the whole year → red   |
| Done when: the accountant can file a VAT return from the worksheet          | `tests/e2e/portal/tax/returns.spec.ts`      | — (e2e)                                            |

Also broken on purpose: the settings feed row (`tax/settings.test.ts`), the server registration check
(`tax/engine.test.ts`), the credit-note ownership check (`tax/credit/scope.test.ts`) and the runtime `/tax` route
(`tax/reports/runtime.test.ts`). Each went red, then green when restored.

## Suites

- `tests/integration/tax`: 33 tests across settings, engine, rules, credit notes, worksheet, reports API and runtime.
- Portal e2e: the 14 tax specs pass; the full portal suite ran 381 specs, and the 8 that failed (roles matrix and
  mobile nav counts, three customer specs that timed out under load) pass on a rerun after the count updates.
- Till UI e2e: the 55 purchases specs pass, including the credit-note row.
- Full integration: see the final run in the PR.

## Screens

`docs/plans/day18/screenshots/portal`: the VAT return (filed and busy) at 1920, 1440, 1366, 768 and 390; rates,
the rate dialog and the read-only rates; settings and read-only settings; the empty summary. Every shot ran an axe
pass and a horizontal-overflow check. Figma has no tax frames; the screens follow the Settings and Inventory
patterns.

## Review

Codex (`gpt-6.1-sol`) reviewed every slice. Fixed: more tests pinned to feed v4; a credit-note number a register
could claim from another register's block; zero-rated and exempt credit notes missing from the workbook; input tax
losing sub-pesewa precision on reload; worksheet heading ids with spaces; the Rates tab not following the clock past
midnight. The final branch review added two more, both fixed: an invoice to a VAT buyer now prints each line's quantity at its
unit price before tax, and an exclusive-price till refuses price-embedded labels (their printed amount already
includes tax, so the quantity would be wrong; weight labels still work). Rejected, with reasons: historical sale and refund payloads, queued outbox events and replay hashes
across the version bumps (dev data and tills are reset with this release, as on Day 17); a v3 refund producer (v3
never left this branch).

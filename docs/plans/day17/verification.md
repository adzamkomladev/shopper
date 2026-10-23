# Day 17 verification

Branch `day17-customers`, built on 22-23 Oct 2026 on the Ubuntu dev box from `docs/plans/day17/plan.md`. Codex
was unavailable, so the `reviewer` agent reviewed each slice and the `ui-reviewer` the screens. Three tracks (A:
credit and loyalty, B: KYC, C: statements and the portal) ran in parallel worktrees and were merged here.

## Checks

| Check                      | Result                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `vp check`                 | 0 errors (warnings pre-existing), after the wiring commit                                                                               |
| `vp run guard`             | all repository rules pass, after the wiring commit                                                                                      |
| Full integration suite     | run in the background after the merge (`full-int` logs); the result belongs to the session that ran it and is not repeated here         |
| Portal e2e, Customers area | `customers` 69 passed in one run before the wiring commit; the `kyc`, `settings` and `users` specs plus the new wiring are listed below |

Commit `186dadc` fixed the regressions the full suite found after the tracks merged.

## Tests per slice

| Slice | Tests                                                                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `tests/integration/customers/{records,merge,archive,export,history}.test.ts`, the permission matrix                                                                                     |
| 2     | `tests/integration/sync/customers/{pull,snapshot,upload}.test.ts` (feed v4, the v3 upcast, quick-create and edit)                                                                       |
| 3     | `tests/integration/sales/customers/b2b.test.ts` (**B2B sale carries buyer TIN onto the invoice and fiscal payload**), `tests/integration/sync/versions.test.ts`                         |
| 4     | `tests/integration/customers/credit/{limit,holds,statement,notes,ageing}.test.ts` (**Credit sale over limit refused**: the race, the forged event, NOT_ELIGIBLE, deposits)              |
| 5     | `tests/integration/till/accounts/{payment,lane}.test.ts` and the X/Z cases                                                                                                              |
| 6     | `tests/integration/customers/loyalty/{fold,settings,redeem,tiers,transfers,refunds}.test.ts` (**Loyalty balance equals ledger fold**: 62 points, no balance column, an `UPDATE` raises) |
| 7     | `customers/credit/interest.test.ts`, `customers/loyalty/{expiry,notices}.test.ts`, `workflows/account`, the Workers suite                                                               |
| 8     | `customers/credit/delivery.test.ts`, `customers/statements/{links,schedule}.test.ts`                                                                                                    |
| 9     | `tests/integration/customers/kyc/settings.test.ts`, `tests/integration/workflows/kyc/*` (credit, staff, expiry, redact), the secrets scan, the Workers suite                            |
| 10    | `tests/e2e/till/ui/customers/{recognise,dialog,manage,tenders,sizes}.spec.ts` (the done-when: a regular customer is recognised at the till by phone number)                             |
| 11    | `tests/e2e/portal/customers/{list,detail,merge,account,points,statement,ageing,purchases,states}.spec.ts`                                                                               |
| 12    | `tests/e2e/portal/{kyc/{queue,review,start},settings/{loyalty,credit,kyc},statements/public}.spec.ts`; the public page at 390 and 1366                                                  |
| wire  | `tests/e2e/portal/settings/statements.spec.ts` (schedule, next run, channel and day validation); the tender filter and wiring are covered by the existing specs                         |

## Deliberate breaks

Each break was made, its test watched fail, then restored.

| Slice | Break                                            | Outcome                                                                                                                            |
| ----- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Remove the `toCsv` formula guard                 | Two export tests red                                                                                                               |
| 2     | Skip re-projection after a snapshot clear        | `pull` "keeps a customer whose upload is still pending" red                                                                        |
| 3     | Drop the customer upsert in `acceptSale`         | `b2b` red                                                                                                                          |
| 4     | Drop `FOR UPDATE` on hold create                 | Still green: `defineCommand` holds a per-org advisory lock. Red only with that lock also removed. The row lock is defence in depth |
| 4     | Accept a credit tender with no hold              | The forged-event case red                                                                                                          |
| 5     | Leave cash account payments out of expected cash | Expected-cash test red (2 000 000 vs 2 030 000)                                                                                    |
| 6     | Earn on the points-tendered amount               | `fold` red at the intermediate check (123 vs 122)                                                                                  |
| 7     | Post interest twice in a period                  | The `interest` replay case red                                                                                                     |
| 8a    | Skip the token's org check                       | The cross-org link case red                                                                                                        |
| 8b    | Drop the period unique key and the send replay   | The schedule re-run case red                                                                                                       |
| 9     | Put the ID number in an event                    | `secrets` red (the strict event schema refuses it)                                                                                 |

## Upgrade note: refund events

`refund.recorded` is v2. A v1 refund (an old till build) of a sale paid on account or with points is
rejected, because that till already paid the whole amount out in its own tenders. Update every till to the
Day 17 build and reset till databases before trading, as `deployment.md` says.

## Screenshots

- `docs/plans/day17/screenshots/portal/`: Customers (list, empty, error, loading, no match, offline, no
  permission, on account), customer detail (deposit, business, archived, merged, shared phone, tier, account,
  payment and credit-note errors, limit, transfer, statement and its range, sent, links, offline, points,
  purchases), ageing, KYC queue, review and start sheet, loyalty, credit and KYC settings, and the public
  statement page with its not-found state. Taken at 1920, 1440, 1366, 768 and 390 where the spec asks for all five.
- `docs/plans/day17/screenshots/till/`: customer dialog (find, match, duplicates, create, edit, offline), chip,
  On account and Points tenders (including over the limit), drawer payment (find, match, cash, MoMo), purchases
  customer column, dashboard tiles in every state, and the recognise flow. Taken at 1920, 1440, 1366, 1024, 768 and 390.
- Statements settings (new in the wiring commit) has a `settings-statements` shot from its e2e spec.

## Known limits

- Ghana Card and every other ID type are checked by hand; there is no provider call (a provider is one adapter
  file, called from `kyc.id.record`).
- Box workflow timers die with the process. The box relaunches accounts, schedules and open KYC cases on boot and
  PostgreSQL deadlines decide; Rivet takes over on Day 36.
- Credit and points need a connection. Only drawer account payments, quick-create and edits work offline.
- A hidden field of the Statements form (for example the day, while the schedule is Off) still validates on save.
- "Next run" on the Statements page is the next occurrence of the day in Accra. The workflow also looks at the last
  period sent, so a first run can happen sooner after a restart.
- A mail-only box (no Arkesel key) cannot send KYC codes or low-stock alerts; the KYC routes answer 503.
- GRA E-VAT submission is not done: Day 20 consumes `fiscalPayload`.
- The email provider's real reply shape is covered only by the fake.

## Missing Figma frames

Figma (`4MtEIWv8yBUBYgkrk4ubPk`, read-only) has Checkout 333:9119, Till dashboard 312:8385, Purchases 99:2496 and
Payment 99:1142 only. There are no frames for the customer list, customer detail, statement, ageing, merge, loyalty,
tiers, KYC, settings (credit, statements, KYC) or the public statement page, or for the till customer, invoice and
account-payment dialogs. They follow the Inventory area patterns, the purchases table and the shift report styles.

## Not checked

No deployment, no real Arkesel or Maileroo send, no Cloudflare Workflow in a live account, and no staging secret
check (none new are required).

# Retro: 45 days to v1.0

5 October → 18 November 2026. 191 commits, 20 merged pull requests, 503 integration test files and 175 browser specs.
Everything in the plan shipped: till, sync, back office, tax, audit, reports, payments, online store, the sealed box,
the archive and migration both ways.

## What worked

- **Tests first, integration only.** A real PostgreSQL 18, golden sales and both adapters caught what unit tests
  would have mocked away. The conformance suite from day 3 let the box (Days 36–40) swap adapters without touching business code.
- **One shared function, two thin shells.** Business code never saw a Cloudflare binding or a Rivet handle, so the
  box reused the cloud's commands, workflows and screens as they were.
- **The guard.** File size, effects, imports and layout rules held for 45 days because CI refused the exceptions.
- **A Codex review before every merge.** It found a real defect on most days (four separate review-fix commits on
  main, more folded into slices), most of them in money, sync or migration edge cases.
- **Disposable data until go-live.** Resetting freely let schema and protocol changes land cleanly instead of
  carrying shims.

## What did not

- **Scope per day crept.** Sundays absorbed it, as planned, but no slack was left for real-hardware days.
- **Hardware was proven late and thin.** The box runs on test machines only, and the Windows/peripheral days were
  the hardest to schedule.
- **Figma ran out before the product did.** From Day 30 most screens (export, migration, box install) had no frame
  and followed the nearest existing pattern.
- **Flaky timing tests.** A handful of onboarding and workflow tests failed once in CI and passed on re-run. Each
  costs a CI cycle; they need fixing, not retrying.
- **Production release waited on approvals** that were requested days before anyone could watch them.

## Next-phase backlog (in order)

1. **v1.5 Online orders for on-prem** (approved, 23 Nov → 1 Dec): the box's shops sell online through the cloud store.
2. **Card and MoMo terminal SDKs**: drive the payment terminal from the till so the amount is never typed twice, and
   reconcile terminal settlements against tenders.
3. **Promotions engine**: price rules by date, product, quantity and customer tier, snapshotted onto the sale line
   like tax so reports never re-derive them.
4. **Purchase orders**: order from a supplier, receive against the order, cost the stock from it; a Workflow that
   waits on the supplier.
5. **Inter-branch transfers**: send and receive stock between branches with both sides counted and the difference
   recorded; a Workflow between the two receipts.
6. **Scales over serial**: read weight from a scale on the till's serial port as well as from priced labels.
7. **Carried gaps**: RustFS in the box installer; scheduling a migration; measuring the cutover estimate on a real
   move; a real-hardware box drill; the flaky timing tests above.

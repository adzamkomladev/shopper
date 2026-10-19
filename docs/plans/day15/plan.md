# Day 15: shifts and cash control

Source: Notion Day 15 "Shifts & cash control" (Mon 19 Oct, Till + API). Planned 19 Oct 2026 with the `planner` agent; Figma read-only.

## Context

Notion goal: "knowing where every cedi went". Tasks: open shift with float, cash drops, audited no-sale with reason, X-report (mid-shift) and Z-report (close), blind cash declaration with per-tender variance, Z printout with the day's audit anchor hash (proper anchoring is Day 20). Day 14 handed over: cash refunds must count in the drawer and the Z.

Nothing for shifts exists yet. Already there: `shift.read`/`shift.write` permissions, the till register report (`packages/core/src/till/reports.ts`), the drawer kick, Day 14 manager PIN approvals, the till audit hash chain, and the refund upload pattern to copy. Day 14 PR #25 is merged (`c7809ac`).

**Required tests (names verbatim):**

- "Shift with sales, refunds, drops and a no-sale → Z-report reconciles to the cedi"
- "Declared vs expected variance computed correctly per tender"

**Done when:** a Z-report matches the drawer.

### Your decisions

1. One open shift per register (drawer). A cashier change mid-shift needs no new record, because every sale, refund and movement already carries its cashier.
2. Sales, tenders, refunds and drawer opens are blocked until a shift is open. The register shows "Register closed. Open a shift".
3. Blind close: cash is counted by denomination, and card and MoMo terminal totals are typed in. Variance per tender appears only after submit. A variance over the register setting (default GHS 5, strictly greater) needs a manager PIN, using the Day 14 mechanism.
4. A portal Shifts screen: a list plus the Z detail.
5. Data is disposable, so resets are fine. The `reviewer` agent replaces Codex. Branch `day15-shifts-cash` from `origin/main`, one commit per slice, one push at the end. `.claude/settings.json` is never staged.

### Defaults taken

- **How sales and refunds join a shift:** a till-only `shift_id` column, stamped inside the existing `sale.complete`/`refund.record` transactions. Sale and refund events are unchanged and the sync protocol stays at 4. Rejected: a time window (drifts with the clock offset) and `shiftId` in the event (protocol bump).
- **One upload per shift:** a `shift.closed` v1 event on its own document lane at close. The portal shows only closed shifts.
- **What the server checks:** the Z's own arithmetic, the closing session's `shift.write` and the approver's `shift.approve`. It does not re-add the sales from Postgres; that cross-check is Day 20.
- **A new permission `shift.approve`** for variance approval. It syncs to tills and needs a role re-seed. A no-sale needs only `shift.write` and a reason.
- **The X-report needs `report.read`.** The cashier role doesn't hold it, so a cashier can't see the expected cash before a blind close.
- **The count is final:** no recount. After the count, selling stops. Close runs at once when no approval is needed.
- **Drops are not guarded.** Refusing a drop larger than expected cash would leak the expected figure; a wrong drop shows up as variance.
- **The Settings "Open drawer" test (Alt+D)** becomes an audited no-sale with the reason "Drawer test".
- **The drawer opens after the commit,** so a printer fault never undoes the record.
- **Anchor:** the `till_audit` head (`chain_seq` and `hash`, or `GENESIS_HASH`), read inside the close transaction before its own audit row. Stored on the shift and printed. Publishing anchors is Day 20.
- **Printing:** an ESC/POS `encodeShiftReport` in `@shopper/hardware`; one shared `ShiftReport` component in `@shopper/backoffice` for the till and the portal. No Z PDF yet.
- **A shift is not a Workflow:** it has no waiting or timers.

## Design

### Cash arithmetic: `packages/core/src/shifts/totals.ts`

Pure, shared by the till (X and Z) and the server re-check, `@shopper/money` only.

- Cash kept from a sale: `Σ cash tenders − change` (rounding is already inside `change`).
- Cash refunds out: `refund.total` where the tender is cash.
- Card and MoMo expected: `Σ tenders of that kind − Σ refunds of that kind`.
- Expected cash: `float + cash kept − cash refunds − drops`. A no-sale adds 0.
- Declared cash: `Σ face × count`.
- Variance: `declared − expected` per tender, signed.
- Approval: required when `|variance| > varianceThreshold` for any tender.

Denominations (counts 0–100 000): GHS 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.01.

### Report (`packages/core/src/schemas/till/shift.ts`)

- X and Z share: `kind`, shift, register, store, opened at/by; sales `{count, gross, tax}` and refunds; `tenders[] {tender, sales, refunds, expected}`; `cash {float, sales, refunds, drops, expected}`; movements; `cashiers[]`.
- Z only: `declared {counts, cash, card, momo}`, `variances[]`, threshold, approver, closed at/by, `anchor {seq, hash}`.
- Reprints print the stored Z.

### Till SQLite: step 8 (`packages/db/sqlite/src/till.ts`)

- **`shift`:** `status open|declared|closed`; `opened_*`, `float`, `float_counts`, `declaration`, `closed_*`, `approver_id`, `report`, `anchor_seq`, `anchor_hash`; the upload-lane columns, as on `refund`.
- **Unique index** `shift_current(org_id, device_id) WHERE status <> 'closed'` enforces one shift per register.
- **`shift_movement`:** `kind drop|no_sale`, amount, reason, actor, session, at. A drop's amount is greater than 0; a no-sale's amount is 0 and its reason is required.
- **`ALTER TABLE local_sale/refund ADD shift_id`**, with indexes.
- **Mirrors:** `packages/db/sqlite/src/schemas/till/shifts.ts`, plus `shiftId` in the `sales.ts`/`refunds.ts` mirrors.

### Till core: `packages/core/src/till/shifts/`

- **`queries.ts`:** `currentShift`, `requireOpenShift` (throws `SHIFT_REQUIRED` or `SHIFT_COUNTED`), `shiftSummary`, `readShiftParts`.
- **`commands.ts`:** `defineCommand`s `shift.open`, `shift.drop`, `shift.nosale` and `shift.print`.
- **`close.ts`:** `shift.declare` refuses with `SHIFT_BUSY` while a draft has a tender and returns the variances and `approvalRequired`; `shift.close` uses `authorize(…, approverId, mandatory)` from `till/approvals.ts`, builds the Z, reads the anchor and stores the report.
- **`report.ts`:** `buildShiftReport`, and `readShiftReport` (the X, needs `report.read`).
- **`uploads.ts`:** the accept, reject and fail marks, copied from `till/refunds/uploads.ts`.
- **Guards** (one `requireOpenShift` call each): `finishDraftSale` (`complete.ts`) and `recordLocalSale` (`record.ts`) also stamp `shiftId`; `addTender` (`tenders/commands.ts`) and `applyPayment` (`tenders/payment.ts`) only check; `plan()` in `till/refunds/record.ts` checks, and the record transaction stamps.
- **Register settings:** `varianceThreshold` (default 50 000) in `schemas/till/register.ts`.
- **`TillError`:** new codes `SHIFT_REQUIRED`, `SHIFT_OPEN`, `SHIFT_COUNTED` and `SHIFT_BUSY`.

### Server, sync and API

- **Postgres:** `packages/db/pg/src/schemas/shifts.ts` produces `0023_shifts.sql` via drizzle-kit (journal `when 1792231200007`): `shift` (tenant, device, store, branch, the open, close and approver fields, float, threshold, the report as jsonb, the anchor, event metadata, `content_hash`); `shift_tender` with a check that `variance = declared − expected`; `shift_movement`.
- **Accept** (`packages/core/src/shifts/accept.ts`): `shift.accept` is a `defineCommand` with `replay`, following `refunds/accept.ts`. Same id and hash replays; a different hash is `CONFLICT`; arithmetic that doesn't reproduce exactly is `SHIFT_MISMATCH`. Authority lives in `shifts/authority.ts`, reusing `sessionAuthority` and `hasGrant`.
- **Upload route:** `POST /sync/shifts` (`packages/api/src/sync/shifts.ts`, registered in `sync/routes.ts`).
- **Upload lane:** `packages/sync/src/uploads/shifts.ts` via `createDocumentUploadWorker`, running after the sale backlog drains, wired in `adapters/box/src/till/host/sync.ts`.
- **Portal API:** `packages/core/src/shifts/list.ts` with `listShifts` and `readShift`; `packages/api/src/routes/shifts.ts` serving `GET /shifts` and `GET /shifts/:id` behind `shift.read`, registered in `app.ts`. Both hosts use the shared Hono app; no port change, so no conformance work.
- **Permissions:** `shift.approve` goes in `packages/auth/src/schemas/permissions.ts`, `roles/defaults.ts` (`tillPermissions`), `core/schemas/till/approvers.ts` (`approvalPermissions`) and the backoffice labels.

### Till host and printing

- **Bridge:** `packages/sync/src/schemas/bridge/shifts.ts` defines `shift.open|drop|nosale|report|declare|close|print`. `hostStatus.shift` comes from `shiftSummary`.
- **Host handler:** `adapters/box/src/till/host/shifts.ts`, routed from `dispatch.ts`. Open, drop and no-sale: commit, publish the status, then open the drawer. Close: `approvals.verify(approval, "shift.approve")`, then close, print the Z, then upload. `drawer.test` (`host/devices.ts`) becomes the no-sale path.
- **Printout:** `packages/hardware/src/escpos/shift.ts` defines `encodeShiftReport`: X/Z heading, a tender table (Expected, Declared, Variance), the cash box line, denominations, drops and no-sales, cashiers, approver, and last "Audit anchor #seq" with the hash in groups of 16.
- **Line limit:** the test page moves to `encodeTestPage` so `host/receipts.ts` stays at or under 250 lines once `printReport` is added.

### UI

Figma has no shift frames and stays read-only. Compose from Sales Reports 375:2566, Menu drawer 368:1754, Review refund 140:19921, Settings · Register 146:4805, Register closed 377:2878.

**Till (`apps/till/ui`):** menu entries Shift **Alt+H**, Cash drop **Alt+K**, No sale **Alt+J** (hidden without `shift.write`); sale screen blocked state for "no shift" and "counting"; Shift screen with Print X **Alt+X**, Close **Alt+Z**, Reprint Z **Alt+R**, the X report (with `report.read`) and the last Z with its upload state; dialogs for open float (denomination grid or amount), drop and no-sale (reason required), Mod+Enter submits, Esc cancels; close stepper (Count cash → Card & MoMo → Result) with nothing expected shown before submit, then the variance table with `ApprovalFields` when over the threshold; a Settings field "Cash variance needing a manager"; the customer display shows Closed without a shift; harness scenarios.

**Portal (`packages/backoffice`):** `queries/shifts/{list,detail}.ts`; `screens/shifts/{list,detail}/screen.tsx`; `components/shifts/list/table.tsx` with a variance badge (Balanced, Short, Over); `components/shifts/detail/*`; the shared `components/shifts/report/*`; `routes/shifts.tsx` and a nav item behind `shift.read`.

**States:** loading, empty, error with retry, offline, no permission, printer offline (the Z is saved and Reprint is offered), and the Day 14 approval states.

## Tests (written first)

- `tests/integration/till/shifts/close.test.ts`: "Shift with sales, refunds, drops and a no-sale → Z-report reconciles to the cedi". GHS 200 float; cash and card sales, cash and card refunds, a GHS 100 drop and a no-sale, nonzero cash rounding on at least one sale and one refund; expected cash 1 036 000 and card 12 000 by hand; every variance 0; a previous shift's sale is excluded; audit rows present, `verifyChain` passes, the anchor equals the chain head.
- `tests/integration/till/shifts/variance.test.ts`: "Declared vs expected variance computed correctly per tender". Cash −3 000, card +10 000, MoMo 0; exactly the threshold closes alone; one pesewa over gives `APPROVAL_REQUIRED`; with an approver it closes with `approver_id` set.
- Till: `till/shifts/{open,cash,count,report}.test.ts` (nothing works without a shift; one shift per register; float equals its denominations; sales and refunds stamped; no-sale needs a reason and is audited; a drop lowers expected cash; the count is final; `SHIFT_BUSY`; the X matches the Z and writes nothing; the X print is audited; the X needs `report.read`); migration step 8; approver missing `shift.approve`; `shift.approve` reaching the till.
- Printing: `tests/integration/receipts/shift.test.ts` (Z has variances, denominations and the anchor; X says "not a close" and has no anchor).
- Server and API: `sync/shifts/accept.test.ts`, `sync/shifts/upload.test.ts`, `api/shifts.test.ts`, the `edge/worker.test.ts` 401s, `till/host/bridge/shifts.test.ts`.
- E2E: `tests/e2e/till/ui/shift/{open,cash,close,report}.spec.ts`, `tests/e2e/portal/shifts/list.spec.ts`, the role matrix count.
- Fixtures: `world(db)` and the till host fixture default to an open shift inserted directly with no audit row (`{shift:false}` opts out); the UI harness status has an open shift; helpers `tests/support/till/shifts.ts` and `tests/support/sales/shifts.ts`.

## Slices

0. Setup and plan.
1. Shift storage, open shift and the sale guard.
2. Cash drops, no-sale and the X-report.
3. Blind close, variance per tender and the Z (the two Notion tests).
4. X and Z printout with the audit anchor.
5. Shift upload and server acceptance.
6. Till host shift bridge.
7. Shifts API for the back office.
8. Till shift screens (UI).
9. Back-office Shifts screen (UI).
10. Wrap-up: docs, full checks, review, PR, Notion.

## Known limits / left out

- The server trusts the till's sale and refund totals until Day 20. Open shifts don't appear in the portal. An unclosed shift spans days until the store-day workflow. The threshold is a till-only setting.
- Upgrade notes: migration `0023_shifts`, till step 8, role re-seed for `shift.approve`. Reset dev data.
- Left out: store-day workflow, Day 20 anchor publishing, Z PDF, GRA Z submission, pay-in/pay-out, safe and bank reconciliation, recounts, blind float, server cross-check of the Z.

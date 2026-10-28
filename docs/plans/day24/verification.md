# Day 24 verification

What was run to prove the sync chaos work, and the checks that went red on purpose first. The plan is in
[plan.md](plan.md).

## Chaos scenarios (`tests/integration/sync/chaos/`, real till host process)

Every scenario drives the built till host (`apps/till/host/dist/server.js`) over IPC against the shared API, with
faults injected by `startHostUpstream`. `vp run test:chaos` runs them; CI runs them in the integration shards on
every push and PR (`offline` and `kill` in the `heavy` group).

| Scenario                        | File                | What it proves                                                                                                                                                           |
| ------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The same batch replayed         | `replay.test.ts`    | 200 queued sales (loyalty, MoMo, credit) reach the server three times, two at once: one sale, line, movement, ledger entry, receipt email, fiscal doc and audit each     |
| Process killed mid-sync         | `kill.test.ts`      | SIGKILL with a push held after the server applied it, during a held pull page, and at ten random points while selling: nothing lost or doubled, receipts contiguous      |
| DO restart mid-sequence         | `sequencer.test.ts` | A sequencer failing on the 3rd of 10 assignments: the partial acceptance is acknowledged and the retry finishes once; workerd aborts StoreSequencer mid-stream too       |
| Network cut mid-tender          | `tender.test.ts`    | MoMo reply lost, `/payments` cut while the webhook confirms: one charge, one payment, one tender; cash and card split fully offline uploads once                         |
| Receipt block exhausted offline | `receipts.test.ts`  | Two registers overflow into their own `-X` series, the counter survives SIGKILL, every number is unique on the server with a fiscal doc, and the refill numbers normally |
| Clock skew ±3 h                 | `clock.test.ts`     | Start +3 h, jump back offline, forward then back, restart: corrected times stay within seconds of the server and every sale converges                                    |
| 24 h offline with 2,000 sales   | `offline.test.ts`   | Two session expiries (steps 14 and 28) each answered by an offline sign-in; 2,000 sales converge under three sessions, two of them offline under one parent              |
| Two tills sell the last unit    | `stock.test.ts`     | Both sales accepted, on hand -1, exactly one open negative alert and one `stock.negative` message                                                                        |

`expectConverged` closes each one: the outbox is empty, every local sale is on the server once with the same
payload and hash, sequences and receipt numbers are unique and the tenant audit chain verifies.

## Supporting integration suites

| File                                          | What it proves                                                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `sync/session/offline.test.ts`                | Adoption once and audited; refused for a forged proof, before the parent, past 7 days, over 8 h, a later grant, a manager permission      |
| `sync/session/cutoffs.test.ts`                | Deactivation and a branch scope change cut an offline session adopted afterwards; a live MoMo proof is authorised once adopted            |
| `sync/shifts/offline.test.ts`                 | A Z closed under an offline session with no sale after it adopts the session; without the descriptor it is refused                        |
| `sync/receipts/clock.test.ts`                 | A slow handshake reads no skew (round-trip midpoint)                                                                                      |
| `stock/negative.test.ts`, `stock/sms.test.ts` | Negative without a reorder point; clears on a delivery; low turns negative in place and back; SMS wording; a superseded SMS sends nothing |
| `stock/list.test.ts`                          | `negative` flag and filter on the list and the product view                                                                               |

## Red first

Each fix was broken once on purpose and its test watched fail: overflow persistence (receipts), the clock anchor
(clock), the 8 h + 1 s session length (24 h), shift adoption, the deactivation and branch cutoffs, the live proof
pattern, the negative raise (stock chaos and alerts) and the superseded-SMS check. Disabling the alert path made the
replay scenario pass again, which located the lock contention fixed before S6 was committed.

## Browser

- Till (S4): the clock banner at 1920, 1440, 1366, 768 and 390 ([screenshots/till](screenshots/till)), and the
  `clock` state in `tests/e2e/till/ui/sale/states.spec.ts` (23/23).
- Portal (S6): `tests/e2e/portal/stock/{negative,stock}.spec.ts`, 11/11: the Negative badge, Z and L switching
  filters, the empty state, axe at each size ([screenshots/portal](screenshots/portal)).

## Local timing

This machine runs the push suites about 7–8× slower than CI (volume 1,731 s against 224 s). The 24 h scenario
took 886 s here; the one-hour offline suite exceeds its 600 s budget locally and takes 87 s in CI.

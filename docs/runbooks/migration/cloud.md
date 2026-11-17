# Runbook: move a box shop to the cloud (box → cloud)

For support staff and the shop owner. The engineering detail is in
[migration.md](../../engineering/migration.md). Plan one evening; the box is frozen from step 3.

## Before the evening

1. **The box is licensed and online**, and reaches the cloud address (`https://…`) the owner will type.
2. **Tills on and online.** Each till is handed its move on its next connection to the box, then claims its place in
   the cloud. A till that stays off for more than 7 days must be enrolled again by hand.
3. **Dry run** (box portal → Organisation → Move to cloud → _Dry run_, or `D`). It must say **Dry run passed**.
4. **Cutover window.** Book the dry run's _About N minutes_ plus 30 minutes after closing.
5. **Coming back from a box?** A shop that moved onto its box earlier moves back the same way: the cloud replaces
   its archived copy with the box's. A shop the cloud holds live is refused ("already in the cloud").

## The evening

| #   | Who, where   | Do                                                                | Check                        |
| --- | ------------ | ----------------------------------------------------------------- | ---------------------------- |
| 1   | Owner, box   | Wait for **The shop looks closed**                                | Tills idle                   |
| 2   | Owner, box   | Run the dry run again if it is older than a day                   | **Dry run passed**           |
| 3   | Owner, box   | _Move to cloud_ (`M`), the cloud address, type `MOVE`, _Move now_ | Banner: the box only reads   |
| 4   | Box          | Sealing → Sending → Opening in the cloud                          | _Moved to the cloud_         |
| 5   | Each till    | Stays on until the box screen shows it **Moved**                  | Tills sell in the cloud      |
| 6   | Owner, cloud | Sign in with the usual email and password                         | Same products, sales, ledger |

## Rollback

- **Before the cloud has every file** (sealing or sending fails): the box reopens as it was and says why. Fix the
  cause (address, line, licence) and press _Try again_; files already sent are not sent again.
- **After the commit**: no rollback from the box. If the box says it is waiting on the cloud, it stays read-only on
  purpose (the cloud may already hold the shop). Escalate; sending the commit again is answered the same.
- **To go back on-prem later**: the cloud → box runbook ([onprem.md](onprem.md)).

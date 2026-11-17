# Moving a shop between the cloud and a box

A shop can move from the cloud onto its own box, and back, with nothing lost: every product, sale, stock record,
file and the audit history arrive identical, and the audit history still proves itself.

## Which way

| You want                                     | Read                                                   |
| -------------------------------------------- | ------------------------------------------------------ |
| The shop to run on its own box, no internet  | [cloud → box runbook](../runbooks/migration/onprem.md) |
| A box shop to move to the cloud subscription | [box → cloud runbook](../runbooks/migration/cloud.md)  |
| A copy of everything, without moving         | Organisation → **Data export** (a Shopper Archive)     |

## What every move has in common

1. **Prepare**: the box installed (for a move on-prem, see the [box guide](box.md)), every till on and online, and a
   **dry run** that passes. The dry run seals the archive with nothing frozen and reads it back; it also estimates
   the cutover window.
2. **One evening, after closing.** The wizard (Organisation → _Move on-prem_ in the cloud, _Move to cloud_ on the
   box) waits until no sale has happened for 15 minutes. From _Start the move_ the old side only reads.
3. **Check.** The new side reports every table and day it received; both must agree before you sell.
4. **Tills** are handed over by themselves at their next connection.
5. **Rollback** depends on the stage: until the new side commits, the old side reopens as it was. After that, going
   back is a move the other way. Each runbook says what is possible at every stage.

The engineering detail (archive format, trust, limits) is in [migration.md](../engineering/migration.md).

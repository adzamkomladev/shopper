# Runbook: move a cloud shop onto its own box (cloud → box)

For support staff and the shop owner. The engineering detail is in
[migration.md](../../engineering/migration.md#cloud--box-day-43). Plan one evening; the shop is frozen only from step 4.

## Before the evening

1. **The box.** Installed on the shop network as `shopper.local`, reachable from every till, with the installer
   `shopper-box-installer.run` copied onto it. Its first-boot screen shows a **setup code** (keep it to hand) and a
   **request code**.
2. **Tills on and online.** Every till must reach the cloud once after the move is verified, to be handed its move.
   A till that is off then must be enrolled on the box again by hand after 7 days.
3. **Dry run** (cloud portal → Organisation → Move on-prem → _Dry run_, or `D`). It seals the archive the move will
   carry and reads it back the way the box will, with nothing frozen. It must say **Dry run passed**. A failure names
   the damaged part: run it again; if it fails twice, stop and escalate (the shop's stored files are damaged).
4. **Cutover window.** The dry run gives _About N minutes_: the time from Start until the box has checked every
   record. Book that plus 30 minutes after closing.

## The evening

| #   | Who, where   | Do                                                           | Check                               |
| --- | ------------ | ------------------------------------------------------------ | ----------------------------------- |
| 1   | Owner, cloud | Wait for **The shop looks closed** (no sale for 15 minutes)  | Tills idle                          |
| 2   | Owner, cloud | Run the dry run again if it is older than a day              | **Dry run passed**                  |
| 3   | Owner, cloud | _Move on-prem_ (`M`), type `MOVE`, _Start the move_          | Banner: the cloud only reads        |
| 4   | Owner, cloud | Wait for the seal, then _Download archive_                   | `archive.shopper` downloaded        |
| 5   | Support, box | `sudo sh shopper-box-installer.run --import archive.shopper` | First-boot screen offers the import |
| 6   | Owner, cloud | Paste the box's request code, _Issue licence_, copy it       | Licence shown                       |
| 7   | Owner, box   | Enter the setup code and the licence                         | The box shows its report            |
| 8   | Owner, cloud | The report agrees on every table and day                     | _Moved to your box_                 |
| 9   | Each till    | Stays on until the cloud screen shows it **Moved**           | Tills sell on the box               |

## Rollback

- **Before step 8 agrees** (move _open_ or _claimed_): _Call the move off_. The cloud takes changes again at once;
  sales tills kept in their outbox go to the cloud. A box that already imported must be reinstalled before the next
  try.
- **Report disagrees** (step 8): the cloud stays frozen and names the tables and days that differ. Run the import on
  the box again; if it still disagrees, call the move off and escalate with the report.
- **After it is archived**: the way back is the box → cloud runbook ([cloud.md](cloud.md)). The cloud's archived copy
  is replaced by the box's, so nothing the box did is lost.

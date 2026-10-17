# Day 13 progress (handoff)

Plan: [plan.md](plan.md). Branch: `day13-desktop-peripherals`, based on `origin/main` at `01bdc83`.
Each slice is one local commit that updates this file. The branch is pushed once, at the end.
Windows-only work is in [windows-handoff.md](windows-handoff.md) (written last).

## Status

| Slice                                        | State                          |
| -------------------------------------------- | ------------------------------ |
| S0 Setup and plan docs                       | done                           |
| S1 Encrypted till SQLite                     | pending                        |
| S2 Sealed secrets, host serves the UI        | pending                        |
| S3 Username/password sign-in, online/offline | pending                        |
| S4 Back-office proxy on the host             | pending                        |
| S5 Register day report                       | pending                        |
| S6 Stock count and receiving                 | server done, till side pending |
| S7 Serial and spooler drivers                | pending                        |
| S8 Device kinds in settings and host wiring  | pending                        |
| S9 Customer display window                   | pending                        |
| F Figma frames                               | pending                        |
| U1 Login and desktop shell                   | pending                        |
| U1b Checkout layout                          | pending                        |
| U2 Dashboard, Sales Reports, Inventory       | pending                        |
| U3 Settings device editors                   | pending                        |
| U4 Customer display screen                   | pending                        |
| P Packaging and provisioning                 | pending                        |
| D Docs, handoff, push, PR, Notion            | pending                        |

## How to resume

1. `git checkout day13-desktop-peripherals`, then `vp install --frozen-lockfile`.
2. `vp run services:up`, then `vp run db:reset && vp run db:seed` (data is disposable).
3. Electron tests need `xvfb-run`.

## Verification log

- S7: `vp test --run tests/integration/hardware` 52/52 (8 new). Spooler proven only with a fake shell; real PowerShell path is in the Windows handoff.
- S6a: PG 0019_stock_documents, acceptStockDocument (count/receipt), POST /sync/stock; 10 new tests, 95 related green. tillPermissions gain report.read, stock.read, stock.write.

## Figma frames (file 4MtEIWv8yBUBYgkrk4ubPk, page "New Login" 173:3087)

Source frames: login 173:3104 / 217:4811, dashboard 339:9672, checkout 339:9712 / 339:9756, responsive 227:4900, input 12:66.
Added for Day 13: login signing in 367:1588, wrong password 367:1689, locked 367:1758, offline 367:1849,
not on this register offline 367:1902; shell offline 368:1709; menu drawer 368:1754, offline 368:1872;
stock count 373:2090, empty 373:2478; receiving 375:2322; sales reports 375:2566, empty day 375:2863;
settings printer connection 375:5608; customer display idle 377:2818, basket 377:2825, paid 377:2864, closed 377:2878.

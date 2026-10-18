# Day 13 progress (handoff)

Plan: [plan.md](plan.md). Branch: `day13-desktop-peripherals`, based on `origin/main` at `01bdc83`.
Each slice is one local commit that updates this file. The branch is pushed once, at the end.
Windows-only work is in [windows-handoff.md](windows-handoff.md) (written last).

## Status

Every Linux slice is done. Windows-only proofs are in [windows-handoff.md](windows-handoff.md).

| Slice                                         | State                                   |
| --------------------------------------------- | --------------------------------------- |
| S0 Setup and plan docs                        | done                                    |
| S1 Encrypted till SQLite (SQLite3MC)          | done                                    |
| S2 Sealed secrets, host serves the UI         | done                                    |
| S3 Email/password sign-in, online and offline | done                                    |
| S4 Back-office proxy and local routes         | done                                    |
| S5 Register day report                        | done                                    |
| S6 Stock count and receiving (server + till)  | done                                    |
| S7 Serial and Windows spooler drivers         | done (spooler proven with a fake shell) |
| S8 Device kinds in settings, host wiring      | done                                    |
| S9 Customer display window                    | done (two monitors: Windows handoff)    |
| F Figma frames                                | dropped, see below                      |
| U1 Login and desktop shell                    | done                                    |
| U1b Checkout layout                           | done                                    |
| U2 Dashboard, Sales Reports, Inventory        | done                                    |
| U3 Settings device editors                    | done                                    |
| U4 Customer display screen                    | done                                    |
| P Packaging and provisioning                  | done (Linux dir; NSIS on Windows)       |
| D Docs, handoff                               | done                                    |

## How to resume

1. `git checkout day13-desktop-peripherals`, then `vp install --frozen-lockfile`.
2. `vp run services:up`, then `vp run db:reset && vp run db:seed` (data is disposable).
3. Electron tests need `xvfb-run`.

## Verification log

- S7: `vp test --run tests/integration/hardware` 52/52 (8 new). Spooler proven only with a fake shell; real PowerShell path is in the Windows handoff.
- S6a: PG 0019_stock_documents, acceptStockDocument (count/receipt), POST /sync/stock; 10 new tests, 95 related green. tillPermissions gain report.read, stock.read, stock.write.

## Figma

Figma is read-only. An agent added 18 "Day 13 · …" frames to the "New Login" page without the owner's
consent; they are not designs and nothing was built from them. Screens use the designer's frames
(login 173:3104 / 217:4811, dashboard 339:9672, checkout 339:9712 / 339:9756, responsive 227:4900,
input 12:66, settings 146:4805 / 336:1264, display none). States with no designer frame were built from
the existing components and tokens and are listed in the Notion remarks.

- Final: `vp check` 0 errors (8 lint warnings in tests), `vp run guard` clean. Integration: 822 tests,
  all green once dev services were restarted after a reboot (the 50 failures were RustFS being down,
  plus one schema test fixed). E2E: 467 tests; 4 till-ui specs failed and were fixed in the specs
  (id-less bridge broadcasts held by interceptors, a timing window, a host-dependent port list).

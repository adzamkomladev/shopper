# Day 13 progress (handoff)

Plan: [plan.md](plan.md). Branch: `day13-desktop-peripherals`, based on `origin/main` at `01bdc83`.
Each slice is one local commit that updates this file. The branch is pushed once, at the end.
Windows-only work is in [windows-handoff.md](windows-handoff.md) (written last).

## Status

| Slice                                        | State   |
| -------------------------------------------- | ------- |
| S0 Setup and plan docs                       | done    |
| S1 Encrypted till SQLite                     | pending |
| S2 Sealed secrets, host serves the UI        | pending |
| S3 Username/password sign-in, online/offline | pending |
| S4 Back-office proxy on the host             | pending |
| S5 Register day report                       | pending |
| S6 Stock count and receiving                 | pending |
| S7 Serial and spooler drivers                | pending |
| S8 Device kinds in settings and host wiring  | pending |
| S9 Customer display window                   | pending |
| F Figma frames                               | pending |
| U1 Login and desktop shell                   | pending |
| U1b Checkout layout                          | pending |
| U2 Dashboard, Sales Reports, Inventory       | pending |
| U3 Settings device editors                   | pending |
| U4 Customer display screen                   | pending |
| P Packaging and provisioning                 | pending |
| D Docs, handoff, push, PR, Notion            | pending |

## How to resume

1. `git checkout day13-desktop-peripherals`, then `vp install --frozen-lockfile`.
2. `vp run services:up`, then `vp run db:reset && vp run db:seed` (data is disposable).
3. Electron tests need `xvfb-run`.

## Verification log
- S7: `vp test --run tests/integration/hardware` 52/52 (8 new). Spooler proven only with a fake shell; real PowerShell path is in the Windows handoff.

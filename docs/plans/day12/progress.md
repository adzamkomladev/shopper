# Day 12 progress (handoff)

Plan: [plan.md](plan.md). Contracts: [design.md](design.md). Branch: `claude/day12-hardware-receipts`,
based on `origin/main` at `c38c883`. Each slice is one local commit that includes an update to this file.
The branch is pushed once, at the end, then goes to `main` as one PR.

## Status

| Slice                                             | State | Commit |
| ------------------------------------------------- | ----- | ------ |
| S0 Setup and plan docs                            | done  | S0     |
| S1 ESC/POS encoder, profiles, TCP driver          | todo  |        |
| S2 Renderer port, receipt component, box renderer | todo  |        |
| S3 Cloud Browser Run renderer                     | todo  |        |
| S4 Electron shell and printToPDF                  | todo  |        |
| S5 Register settings and printing on sale         | todo  |        |
| S6 Till receipt PDF and upload                    | todo  |        |
| S7 Till Settings screen                           | todo  |        |
| S8 Reprint, preview, completion print status      | todo  |        |
| S9 Docs, review, push, PR, merge, Notion          | todo  |        |

## Current slice

S1. Next step: `test-author` writes `tests/integration/hardware/printing/profiles.test.ts` and
`tests/support/hardware/escpos.ts`.

## How to resume

1. Check out the branch: `git checkout claude/day12-hardware-receipts`.
2. Install dependencies: `vp install --frozen-lockfile`.
3. Start services: `vp run services:up` (PG18, Rivet, RustFS, virtual printer on 9100).
4. Reset the database: `vp run db:migrate && vp run db:seed`. Data is disposable.
5. Electron tests need `xvfb-run` (installed at `/usr/bin/xvfb-run`).

## Known failures and blockers

None yet.

## Verification log

None yet.

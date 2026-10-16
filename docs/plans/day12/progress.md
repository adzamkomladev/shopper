# Day 12 progress (handoff)

Plan: [plan.md](plan.md). Contracts: [design.md](design.md). Branch: `claude/day12-hardware-receipts`,
based on `origin/main` at `c38c883`. Each slice is one local commit that includes an update to this file.
The branch is pushed once, at the end, then goes to `main` as one PR.

## Status

| Slice                                             | State | Commit |
| ------------------------------------------------- | ----- | ------ |
| S0 Setup and plan docs                            | done  | S0     |
| S1 ESC/POS encoder, profiles, TCP driver          | done  | S1     |
| S2 Renderer port, receipt component, box renderer | done  | S2     |
| S3 Cloud Browser Run renderer                     | todo  |        |
| S4 Electron shell and printToPDF                  | todo  |        |
| S5 Register settings and printing on sale         | todo  |        |
| S6 Till receipt PDF and upload                    | todo  |        |
| S7 Till Settings screen                           | todo  |        |
| S8 Reprint, preview, completion print status      | todo  |        |
| S9 Docs, review, push, PR, merge, Notion          | todo  |        |

## Current slice

S3. Next step: confirm the Browser Run `quickAction` binding API in the Cloudflare docs, then write the workerd renderer conformance test against a Chromium stand-in.

## How to resume

1. Check out the branch: `git checkout claude/day12-hardware-receipts`.
2. Install dependencies: `vp install --frozen-lockfile`.
3. Start services: `vp run services:up` (PG18, Rivet, RustFS, virtual printer on 9100).
4. Reset the database: `vp run db:migrate && vp run db:seed`. Data is disposable.
5. Electron tests need `xvfb-run` (installed at `/usr/bin/xvfb-run`).

## Known failures and blockers

## Verification log

- S1: `vp test --run tests/integration/hardware` 15/15. Guard and `tsc -b` clean. Manual review (Codex
  unavailable) found unsanitised right-hand receipt columns (ESC/POS injection through cashier
  names), a false "offline" on printers that keep 9100 open, a single-shot socket error handler and
  an unbounded QR bitmap. All four are fixed, with regression tests for the first two.
- S2: renderer conformance (box) plus Bun render 23/23 together with the hardware suite. Guard and `tsc -b`
  clean. Versions: satori 0.33.5, @resvg/resvg-wasm 2.6.2, pdf-lib 1.17.1, @fontsource/geist 5.2.9. The
  review moved the shared receipt rules (tax rows, tender label/detail, QR payload) into `format.ts`,
  dropped the unused 600 font weight, made a failed wasm init retryable and added a content-height
  conformance case. Bun gets the build constants through `--preload ./tooling/build/bun.ts` in the
  test only, not a repo-wide bunfig.

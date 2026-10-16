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
| S3 Cloud Browser Run renderer                     | done  | S3     |
| S4 Electron shell and printToPDF                  | done  | S4     |
| S5 Register settings and printing on sale         | done  | S5     |
| S6 Till receipt PDF and upload                    | done  | S6     |
| S7 Till Settings screen                           | todo  |        |
| S8 Reprint, preview, completion print status      | todo  |        |
| S9 Docs, review, push, PR, merge, Notion          | todo  |        |

## Current slice

S7. Next step: design the "Edit printer" row in Figma (copy of 146:4805), then `test-author` writes the Settings screen e2e specs.

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
- S3: workerd renderer conformance 7/7 against `tooling/browser/server.ts`, a Playwright Chromium stand-in.
  It first went red with `cloudflareRenderer is not a function`. The 58 mm case then caught a 416 px width:
  receipt HTML now uses border-box like Satori. Guard and `tsc -b` are clean.
  - Deviation: `BROWSER` is bound without `"remote": true`, because nothing calls it locally and remote
    needs a Wrangler login.
  - Deviation: the renderer is exported but not passed into `serveRuntime`. There is no consumer until
    online orders.
  - Generated edge types were refreshed without a local `.dev.vars` file, so no machine-specific secret
    names land in git.
  - Review fixes: Chromium can no longer be orphaned on start-up failure, and `stop` awaits close.
    Renderer errors carry the response body.
- S4: Electron 44.5.1 (published 2026-09-30), pixelmatch 7.2.0, pngjs 7.0.0, @types/pngjs 6.0.5. The suite first
  went red with `parentRenderer is not a function`. Electron conformance 6/6 and the host-fork seam test pass.
  Equivalence on the golden 80 mm receipt: 1003 px both, 6693 px differ (1.16%, limit 2%). It first measured
  6.01% because Satori rounds fractional line heights up (1.35 x 22 = 29.7 became 30); whole-pixel line
  heights in `ReceiptView` fixed that without loosening the tolerance.
  - Electron 44 has no postinstall: the binary downloads on first `require("electron")`, so no `allowBuilds` entry.
  - Chromium rounds custom PDF page sizes to a ~1 pt grid (72 mm came out 204.96 pt). `render.ts` asks for 2 pt
    more and crops the media box back to the exact size.
  - Deviation: the host seam test proves Electron forks the host (`ELECTRON_RUN_AS_NODE`) and opens the till
    window on its ready capability. Nothing in the host requests a render yet, so a render through the host
    waits for S5/S6.
  - Deviation: `startTillHost` does not take a renderer yet. `server.ts` builds the `parentRenderer` (routing
    replies, disposing on stop or failed start) and S5 hands `parent.renderer` to the host. The `boxRenderer()`
    fallback also waits for S5b: importing it bundles satori's wasm loader into the Node host dist, which then
    fails on `__dirname`.
  - Measured equivalence (golden 80 mm): 1003/1003 px tall, 6693 px differ = 1.16%. `MAX_DIFF_RATIO` is 1.75%.
    A 40-line receipt (over 2000 px, past the 1024 px Xvfb screen) renders at the same height as the box
    renderer within 8 px, so hidden windows are not clamped to the screen.
  - Review fixes: Electron quits when its IPC parent disconnects; tests spawn it in its own process group and
    kill the whole group; renders are serialised with a 10 s timeout; both windows deny popups, webviews and
    foreign navigation.
- S5: `tests/integration/hardware` 41/41 (settings 7, sale 3, drawer 5, failure 1, plus S1-S4 suites).
  `tests/integration/{hardware,till,sales,payments,auth}` 326 passed, 3 skipped; golden sales exact.
  Guard, `tsc -b` and `vp check` clean; the host still bundles (`node:net` stays external).
  - Deviation: errors reuse the bridge vocabulary: `permission` and `REVISION_STALE` (tests and design.md updated).
  - Deviation: the store and register names apply when the receipt is built (`complete.ts` reads `till_setting`
    in the sale transaction), so stored JSON, printout, PDF and reprints agree. No saved row, no override.
  - `receipt_output` gets its row inside the sale transaction (one row per sale); print outcomes upsert it.
    Audits: `receipt.print` (first automatic copy), `receipt.reprint` (any bridge reprint, even when the
    first print failed), `receipt.print.failed` (new; carries the error). Kick-only jobs write no audit.
  - `printerDrawer` now sends `init` before the kick (the drawer test expects it).
  - `register.settings` added to the permission list, the till-allowed set (so cashier sessions can carry it),
    and the back office labels/groups. Admin and superadmin get it through the existing role filters.
  - Audit redaction hides `requirePinForReturns` in the settings before/after (the key matches the `pin` rule); the
    flag is also audited as `returnsNeedManagerApproval {before, after}`. The shared redactor is unchanged.
  - Added a MoMo-only drawer test (confirmed momo tender inserted directly; the provider is covered elsewhere).
  - `hostStatus.settings/printer/registerCode` are required; no till-ui fixture builds a HostStatus, so none changed.
  - `registerCode` comes from the host configuration's receipt codes (empty string when absent).
  - Review fixes: all printer jobs run through one promise chain (no interleaved bytes; status follows the latest
    job; test in `concurrency.test.ts`). A settings row that no longer parses is treated as absent, so it never
    fails a sale or the status (test in `settings.test.ts`). `reset()` runs only when the printer config changed.
    `afterSale` captures the seller's audit context at sale time. Each job reads settings once and carries a
    narrowed `Ready` type. `readRegisterSettings(db, identity)` takes one argument. The basket handlers moved from
    `dispatch.ts` (now 129 lines) to `basket.ts`, with the shared types in `host/types.ts`.
- S6 (till PDF + upload): see results below.
  - S6a: after `sale.complete` the host renders the PDF (paperMm from settings, `reprint: false`) on its own
    chain, separate from printing, so a down printer or a slow render never delays the other. It stores it with
    `storeReceiptPdf` (sha256 from `@shopper/utils`, audit `receipt.pdf.store`). Errors are logged, never fail the sale.
    `startTillHost(raw, send, renderer?)`: `server.ts` passes `parent.renderer` under Electron; otherwise the box
    renderer is `import()`ed on first use. `tooling/build/server.mjs` marks `satori` and `@resvg/resvg-wasm`
    external (declared in `apps/till/host/package.json`), which fixes S4's `__dirname is not defined`. The host
    tests spawn the built `dist/server.js` (they rebuild it), so `pdf.test.ts` renders through the real bundle.
  - S6b: migration `0018_receipts.sql` (asset policy, `sale.receipt_asset_id` + FK) and Drizzle updated;
    `issueReceiptUpload` / `confirmReceiptUpload` in `@shopper/assets` (audits `asset.receipt.issue|confirm`);
    `POST /sync/receipts` and `/sync/receipts/:assetId/confirm`; `receipts/` routing in both Blobs adapters,
    box and cf runtime wiring, `RECEIPTS` bindings (edge + portal), `SHOPPER_S3_RECEIPTS_BUCKET`, RustFS
    `shopper-receipts-dev` in `vp run storage:setup`; `createReceiptUploadWorker` in `@shopper/sync`.
  - Deviation: `shopper_preserve_sale` (0010) rejected every update except the first store sequence, so 0018
    replaces it to also allow the first `receipt_asset_id` assignment with all else unchanged.
  - Review fixes: a linked receipt is final: `issueReceiptUpload` answers `{assetId, linked: true}` with no grant
    and no new audit, and the worker then only records the upload locally (crash recovery; `recovery.test.ts`).
    The worker honours `next_upload_at` (push backoff growing with `upload_attempts`; 404/413 take the longest
    backoff); start, acknowledgement and PDF-stored triggers skip PDFs still backing off, Sync now forces.
    Residual risk: `retry.test.ts` relies on the second sale taking longer than the first 0.5-1 s backoff
    (passed 3 of 3 reruns). A confirm mismatch deletes the rejected object. `storeReceiptPdf` upserts and resets
    the upload state, since a re-stored PDF must be uploaded afresh. `pending()` selects ids; each PDF is loaded
    on its own. Packaging note added to `apps/till/electron/README.md`.
  - Deviation: failures also audit `receipt.pdf.upload.failed` (every mutation is a command).
  - Deviation: cf `cloudflareBlobs` without a `receipts` binding keeps `receipts/` keys in `BLOBS` (the shared
    blobs conformance writes `receipts/a.pdf`); grants are 503 either way.
  - Dev `RECEIPTS` binding is `remote: true` on `shopper-receipts-dev`, like `IMPORTS` on `shopper-imports-dev`.
  - Owner actions: create the `shopper-receipts-dev` and `shopper-receipts-staging` R2 buckets and an Object Read & Write token scoped to
    it; set `SHOPPER_S3_RECEIPTS_BUCKET` (+ existing `SHOPPER_S3_*`) as Worker secrets and in `apps/edge/.dev.vars`;
    for the box set the same names. Until then grants answer 503 and tills keep retrying.

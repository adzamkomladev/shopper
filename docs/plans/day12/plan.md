# Day 12 plan — Hardware layer & receipts

## Context

Notion card **12 · Hardware layer & receipts** (Fri 16 Oct, page `3eba2c99-9ce9-819c-b25d-de99ead460cd`): _everything about printing and peripherals that can be built and proven without Windows_, so Day 13 (Windows) only adds USB/serial drivers and the installer.

State on `main` (c38c883, Day 11 merged):

- `@shopper/hardware` is an empty stub (`export {}`), layer 3.
- The receipt document already exists: `receiptDocument` v1 (`packages/core/src/schemas/receipts/document.ts`), `buildReceipt` (`packages/core/src/receipts/build.ts`), stored in till SQLite `local_sale.receipt` and PG `sale.receipt`.
- No Renderer port, no receipt component, no satori/resvg/pdf-lib/electron deps, no till settings, no Reprint.
- `apps/till/electron` is a stub. The till host is a Node process (`apps/till/host`, `startTillHost`).
- The virtual printer exists (`tooling/printer/server.mjs`, compose service on 9100); `tests/integration/hardware/printer.test.ts` spawns it and reads captured bytes.

Figma (file `4MtEIWv8yBUBYgkrk4ubPk`): **146:4805** Settings · Register (the new till screen), **136:2137** purchase detail with Reprint + Receipt metadata, **12:66** input field style, **45:852** till frames (nav, sale, purchases) for consistency.

### Owner decisions

1. **Electron now (minimal):** a real Electron main process with a hidden-window `printToPDF`/`capturePage` service, run under `xvfb-run` on Ubuntu in tests.
2. **Settings:** Register tab only; other tabs hidden (no dead buttons).
3. **Store/Register name** are per-register display overrides: till UI and the receipt branch line. Org name and TIN stay from the org.
4. **Printer address** is editable in Settings via an "Edit printer" row (model, host, port, paper), audited.
5. **Clear cart after a sale:** On = the next scan/Enter starts a new sale straight from the completion view; Off = the completion view stays until Enter / New sale.
6. **PDF storage:** dedicated private receipts bucket (R2 `shopper-receipts-staging` + scoped S3 token, which the owner creates; RustFS `shopper-receipts-dev` on the box).
7. **Browser Run:** real `BROWSER` binding plus a real cloud adapter; CI uses a local Chromium stand-in; no live account check. Wired into the runtime only, with no route until online orders.
8. **Reprint** ships today (Figma 136:2137), audited, printed with a `REPRINT` banner, and never opens the drawer.
9. **Data is disposable:** reset PG/D1/KV/till SQLite freely; migrations need not be backward compatible.
10. **No Codex:** review with the `reviewer` agent (manual checklist), `/code-review`, `ui-reviewer`.
11. **Git:** branch `claude/day12-hardware-receipts` from `origin/main`; commit after every slice; **push once at the end**; PR → watch CI → merge when green.

Defaults I'm taking (say if wrong):

- A new permission `register.settings` (owner/manager) gates settings save, test print and drawer test. Reprint needs only `sale.create` and is audited.
- Receipts print `GHS`, not ₵ (ESC/POS code pages lack it).
- E-VAT QR placeholder payload is `{receiptNumber}|{saleId}`, captioned "E-VAT QR pending".
- The scanner row is generic ("USB keyboard input") with no fake Connected badge.

## How the work runs

| Step                               | Tool                                                                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan → slices                      | `planner` agent (done) + `/feature-plan`; plan copied to `docs/plans/day12/plan.md`                                                                                                                  |
| Failing tests per slice            | `test-author` agent, then `/tdd-slice`                                                                                                                                                               |
| Ports, adapters, Workers, Electron | `implementer` agent + `/cloud-box-parity`; `cloudflare`, `workers-best-practices`, `wrangler` skills and the Cloudflare docs MCP for Browser Run; context7 for satori, resvg-wasm, pdf-lib, Electron |
| Till screens                       | `ui-builder` agent + `/ui-screen`, Figma MCP `get_design_context` on 146:4805, 136:2137, 12:66; shadcn MCP for missing primitives (Switch, Select)                                                   |
| Browser verification               | `/ui-verify` with `playwright-cli` (Playwright MCP fallback) at 1920/1440/1366/768/390                                                                                                               |
| After each slice                   | `checker` agent (`vp check`, `vp run guard`, `vp test --run` scoped + full at the end)                                                                                                               |
| Before each commit                 | `reviewer` agent (no Codex) + `/code-review`; `ui-reviewer` for `.tsx`                                                                                                                               |
| Finish                             | `/pre-merge-review` (Codex skipped), push, PR, CI, merge, Notion                                                                                                                                     |

A progress/handoff doc `docs/plans/day12/progress.md` (status table, current slice, decisions, how to resume, blockers, verification log) is updated in every slice commit.

## Slices (each one is a commit)

### S0 — Setup and plan docs

- `git fetch && git checkout -B claude/day12-hardware-receipts origin/main`. `vp install`, `vp run services:up`, reset DB (`db:migrate`, `db:seed`). Check `xvfb-run` and Playwright Chromium.
- Write `docs/plans/day12/{plan,design,progress}.md`. `design.md` holds the contracts: Renderer port, settings schema, SQLite tables, bridge ops, PG 0018, upload API.

### S1 — `@shopper/hardware`: ESC/POS, profiles, template, TCP driver

- Deps: `qrcode-generator@2.0.4`, `valibot@1.1.0`, `@shopper/core`, `@shopper/money`.
- `src/types.ts`: `ReceiptPrinter { print(bytes) }`, `CashDrawer { open() }`; `Scanner`, `CustomerDisplay`, `Scale` as types only.
- `src/profiles.ts`:
  - paper `80 → {dots 576, mm 72, cols 48}` and `58 → {384, 48, 32}`;
  - `printerProfiles` for epson/xprinter/bixolon: cut command, raster command, native QR yes/no, drawer pulse `{pin 0, on 25, off 250}`.
- `src/escpos/encoder.ts`: an `escpos()` builder with init, text, bold, align, size, feed, raster, qr (native `GS ( k` or a `GS v 0` bitmap fallback), drawer (`ESC p 0 25 250`), cut and bytes.
- `src/qr.ts`: `qrMatrix(text)`, shared by the ESC/POS fallback and the visual receipt.
- `src/escpos/receipt.ts`: `encodeReceipt(receipt, {profile, paperMm, reprint, openDrawer})`.
  - Header: store, TIN, branch, receipt no., cashier.
  - Lines, then net / NHIL / GETFund / VAT, tenders and change.
  - E-VAT QR placeholder.
  - Amounts go through `@shopper/money` `toDecimal`; non-ASCII text is transliterated.
- `src/network.ts` (export `./network`, `node:net`, host only): `networkPrinter({host, port=9100, timeoutMs})` throws `PrinterOffline`; `printerDrawer(printer, profile)`.
- Test support `tests/support/hardware/escpos.ts`: `decodeEscPos(bytes) → {text[], commands[]}`.
- Tests: `tests/integration/hardware/printing/profiles.test.ts` covers per-profile QR/cut/columns, the exact drawer pulse bytes, 58 mm columns and transliteration.

### S2 — Renderer port, shared receipt component, box renderer

- `packages/ports/src/types.ts`: `Renderer.receipt(receipt: Json, {paperMm: 58|80, reprint}, format: "pdf"|"png") → Uint8Array`.
- `packages/conformance/src/cases/renderer.ts`: `rendererConformance`. It checks:
  - PNG width is 576/384 (from IHDR);
  - the PDF is a single page 72/48 mm wide (via pdf-lib);
  - `reprint` changes the image;
  - an invalid receipt is rejected.
- `@shopper/hardware/receipt`: `ReceiptView({receipt, paperMm, reprint})`.
  - Satori subset only: flex, inline styles, no grid.
  - The QR is an SVG data URI built from `qrMatrix`.
  - It is the single component used by the till preview, Electron, the box renderer and Browser Run.
- `@shopper/hardware/render`:
  - `receiptHtml()` (`renderToStaticMarkup` with embedded fonts);
  - `pngPdf(png, paperMm)` (pdf-lib 1.17.1);
  - `fonts.gen.ts`: Geist 400/600/700 woff as base64, generated by `tooling/fonts/receipt.ts` from `@fontsource/geist@5.3.0`. The installed variable font is woff2-only, which Satori can't read.
- `packages/adapters/box/src/renderer.ts`: `boxRenderer()` = satori 0.33.5 → `@resvg/resvg-wasm` 2.6.2 → `pngPdf`. Wasm is used rather than native resvg because of the sealed Bun binary.
- Tests: `tests/integration/ports/renderer.test.ts` (box conformance) and `tests/integration/hardware/render/bun.test.ts` (renders under Bun).
- Before installing, re-check every pinned version with `npm view`; use versions at least two weeks old.

### S3 — Cloud renderer (Browser Run)

- Load the `cloudflare`/`wrangler` skills and confirm the `quickAction` binding API in the Cloudflare docs MCP.
- `apps/edge` + `apps/portal` `wrangler.jsonc`: `"browser": {"binding": "BROWSER"}`; regenerate the types.
- `packages/adapters/cf/src/renderer.ts`: `cloudflareRenderer(browser)` takes a `quickAction("screenshot", {html: receiptHtml(...), viewport width = dots, fullPage})` screenshot and passes it to `pngPdf`. It is wired into `cloudflareRuntime` only.
- `tooling/browser/server.ts`: a local Playwright Chromium stand-in, following the `tooling/paystack/server.ts` pattern.
- Test: `tooling/worker/tests/renderer.test.ts` runs workerd conformance with a fake `BROWSER` that forwards to the stand-in.
- CI: add a `playwright install --with-deps chromium` step to the foundation job if it's missing.

### S4 — Electron till shell + printToPDF

- `apps/till/electron`, dep `electron@44.5.1` (verify), `allowBuilds: electron` in the pnpm workspace.
- `src/main.ts` forks the till host (`ELECTRON_RUN_AS_NODE`), sends `{type:"start", config, renderer:"parent"}`, answers `render` IPC messages, and opens the till-ui window once the host is ready.
- `src/render.ts`: a hidden offscreen window (no preload, no Node access) loads the `receiptHtml` data URL.
  - PDF: `printToPDF` with page width 72/48 mm, zero margins.
  - PNG: `capturePage()`.
- IPC contract: `@shopper/hardware/schemas` `renderRequest` / `renderReply`.
- Host: `packages/adapters/box/src/till/host/renderer.ts` `parentRenderer(send)` correlates ids with a 15 s timeout. `startTillHost` uses it when started with `renderer: "parent"`, and `boxRenderer()` otherwise.
- Tests (run under `xvfb-run -a`):
  - `tests/integration/hardware/render/electron.test.ts`:
    - Electron conformance;
    - the real host under Electron completes a sale and stores a one-page `%PDF-` that is 72 mm wide.
  - `tests/integration/hardware/render/equivalence.test.ts`: the same fixed receipt rendered by Electron and by the box renderer.
    - Both PNGs are 576 px wide.
    - Heights differ by at most 8 px.
    - pixelmatch at threshold 0.2 finds at most 2% of pixels different.
    - The tolerance constants are named and marked as calibration.
    - Test deps: pixelmatch 7.2.0, pngjs 7.0.0.

### S5a — Register settings (till storage + bridge)

- Till SQLite: append a migration step.
  - `till_setting(org_id, device_id, revision, payload, updated_at)`.
  - `receipt_output(sale_id, printed_at, print_error, reprints, pdf, pdf_sha256, pdf_size, asset_id, uploaded_at, upload_attempts, next_upload_at)`.
  - Drizzle schemas in `packages/db/sqlite/src/schemas/till/{settings,receipts}.ts`.
- `packages/core/src/schemas/till/register.ts` `registerSettings`:
  - `storeName`, `registerName`, `printAutomatically`, `paperMm 80|58`, `clearCartAfterSale`, `requirePinForReturns` (stored now, enforced Day 14);
  - `printer: null | {model, connection: {kind: "network", host, port}}`.
- `packages/core/src/till/register/settings.ts`: `readRegisterSettings` falls back to the enrolled identity. `saveRegisterSettings` is a `defineCommand` that needs `register.settings`, checks the revision (`REVISION_STALE` when stale) and writes audit `till.settings.save` with before and after.
- Permission `register.settings` in `packages/auth/src/schemas/permissions.ts` and in the seed roles.
- Bridge: `packages/sync/src/schemas/bridge/devices.ts` adds `settings.save`, `printer.test`, `drawer.test` and `receipt.print {saleId}`, registered in `browserRequests`.
  - `hostStatus` gains `settings` (with revision), `printer {state, lastJob}` and `registerCode`.
  - New ops go in a new `host/devices.ts`. `dispatch.ts` is at 238 of 250 lines, so it gets one routing line only.
- Tests: `tests/integration/hardware/printing/settings.test.ts` (defaults, conflict, forbidden, audit).

### S5b — Printing on sale completion

- `packages/adapters/box/src/till/host/receipts.ts` `createHostReceipts`.
  - `afterSale(saleId)`:
    - with auto-print on, encode the receipt and print it; the drawer kick is sent **only** when there's a cash tender;
    - with auto-print off and a cash tender, send a kick-only job;
    - a failure never fails the committed sale: it sets `print_error` and the status `printer.state = "offline"`.
  - `print(saleId)` is the reprint: a `REPRINT` banner, no kick, audit `receipt.reprint`, `reprints++`.
  - `testPrint()` and `openDrawer()`.
- Receipt store/branch lines use the settings overrides.
- Tests in `tests/integration/hardware/printing/` (each spawns the virtual printer on its own port):
  - `sale.test.ts`: a real host completes the golden split sale; the decoded text equals `tests/fixtures/receipts/escpos/split.txt`.
  - `drawer.test.ts`: cash and cash+card kick once; card-only, MoMo-only and reprints never kick; auto-print off with cash sends a kick-only job.
  - `failure.test.ts`: printer down → the sale still commits, status offline; printer back up → reprint works and is audited.

### S6a — Till digital receipt PDF

- After the sale, the host renders the PDF through its Renderer (Electron when present, box otherwise) and stores it with `storeReceiptPdf` (sha256 from `@shopper/utils`, audit `receipt.pdf.store`).
- Test: `tests/integration/till/host/receipts/pdf.test.ts`: PDF stored with its sha and size; upload waits for the sale acknowledgement.

### S6b — Upload to R2 / RustFS

- PG migration `0018_receipts.sql` (wiping the DB is fine):
  - `asset.purpose += sale_receipt`, `asset.bucket += receipts`, policy check updated;
  - `sale.receipt_asset_id` with an FK to asset;
  - Drizzle schemas updated.
- `packages/assets/src/receipts.ts`, both audited:
  - `issueReceiptUpload`: org and device must own the sale, size ≤ 1 MiB, `application/pdf`, sha256; idempotent per sale; returns a presigned PUT.
  - `confirmReceiptUpload`: bounded `blobs.get`, size and sha check, then links the sale.
- `packages/api/src/sync/receipts.ts`: device-authed `POST /sync/receipts` and `POST /sync/receipts/:assetId/confirm`.
- Blobs: `receipts/` keys route to the receipts store.
  - Cloud: `RECEIPTS` R2 binding and an S3 signer for `SHOPPER_S3_RECEIPTS_BUCKET`.
  - Box: RustFS bucket created in `tooling/storage/setup.ts`.
  - No filesystem fallback for client uploads.
- `packages/sync/src/uploads/receipts.ts` `createReceiptUploadWorker` runs on start, on push acknowledgement (the existing `onAcknowledgment` hook) and on Sync now. It reuses the push backoff. There's no polling or cron.
- Tests:
  - `tests/integration/sync/receipts/upload.test.ts`: asset linked, bytes match, audits present.
  - `tests/integration/sync/receipts/rejects.test.ts`: wrong org/device → 404; >1 MiB → 413; tampered PUT → 409; reissue is idempotent; no S3 → 503 then retried.
  - Upload conformance on both adapters.

### S7 — Till Settings screen (Figma 146:4805)

- `TillView += "settings"`; the top nav gets Settings (`Alt+T`).
- Files:
  - `screens/settings/screen.tsx`;
  - `components/settings/{store,receipts,devices,printer,cashier}.tsx`;
  - `settings/store.ts`, using `useSyncExternalStore` over host status (no effects).
- Cards follow the Figma frame: Register & store, Receipt preferences (auto-print switch, paper width select), Connected devices, Cashier preferences.
  - Header strip: "Register ID: {registerCode} · Currency: GHS".
  - Footer: "Changes apply to this register only." with Cancel (`Esc`) and Save changes (`Mod+S`).
- The printer row shows model · connection · paper and a Connected / Offline / Not checked badge from the last real job. Actions: Test print (`Alt+R`), Open drawer (`Alt+D`), and an Edit printer disclosure (model, host, port).
  - Design that row in Figma first (copy of 146:4805) via `/figma-use`.
- States: loading, saving, saved toast, field errors, storage error with Retry, no permission (read-only with a reason), no printer (empty state with Add printer), printing / printed / offline.
- Add shadcn Switch/Select to `@shopper/ui` if they're missing.
- e2e tests:
  - `tests/e2e/till/ui/settings/screen.spec.ts` (harness): keyboard path, states, axe, screenshots at 1366/1440/390.
  - `settings/live.spec.ts`: real host plus virtual printer test print.
- Then run the `ui-verify` loop and `ui-reviewer`.

### S8 — Reprint, preview, completion print status, clear cart

- Purchase detail (Figma 136:2137):
  - header Reprint button (`Alt+R`);
  - new `components/purchases/detail/receipt.tsx` "Receipt metadata" card: receipt no., register · cashier, delivery ("Printed · reprinted 2×", "Digital copy uploaded / waiting"), Reprint receipt, and a Preview receipt toggle (`Alt+V`) showing `ReceiptView` from the stored JSON.
- `purchaseDetails` gains `delivery`.
- Sale-complete view (`tender/state.tsx`): print status line, plus Print / Reprint when the print failed or auto-print is off. Clear-cart behaviour follows decision 5.
- Till-ui adds `@fontsource/geist` 400/600/700 so the preview matches the PDF.
- e2e tests: `tests/e2e/till/ui/purchases/reprint.spec.ts`, plus an extended `sale/receipt.spec.ts`. Then `ui-verify` and `ui-reviewer`.

### S9 — Docs, verification, review, ship

- Docs:
  - `layout.md`: hardware and electron rows;
  - `architecture.md`: Renderer port;
  - `platforms.md`: PDF row is Browser Run / Satori→resvg-wasm→pdf-lib / Electron;
  - `assets.md`: receipts purpose and bucket;
  - `deployment.md`: `BROWSER`, `RECEIPTS`, the S3 receipts token;
  - `testing.md`: virtual printer, xvfb, equivalence tolerance;
  - `frontend.md`: the receipt inline-style exception;
  - READMEs for hardware, till/electron and till/host.
- Write `docs/plans/day12/verification.md`.

## Verification (end of day)

1. Full gates: `vp check`, `vp run guard`, `vp test --run` (full integration), workerd suite `vp -C tooling/worker/tests exec vitest run`, `vp run build`, `vp run typecheck`, `vp run e2e`, plus the public Playwright config. Counts go in `verification.md`.
2. Virtual printer by hand: `vp run services:up`, run the till host with a printer at 127.0.0.1:9100, complete cash and card sales, then decode the files in `tooling/printer/captures/`. Expect the receipt text for both, with the drawer kick only on the cash sale.
3. Electron under xvfb: launch the shell, complete a sale, open the stored PDF, and compare it with the box-rendered PNG.
4. Till UI in a real browser against a real host: Settings edit/save/test print, a sale with auto-print, Reprint from Purchases, receipt preview. Screenshots against 146:4805 and 136:2137 at every size; check console and overflow.
5. Review: the `reviewer` agent and `/code-review` over the full diff, plus `ui-reviewer`. Fix every confirmed finding, then `/pre-merge-review` (Codex skipped).
6. Ship:
   - push the branch once;
   - open a PR to `main` with no attribution;
   - bind it with `ccd_pr`, fix CI failures and merge when green with no open threads;
   - record the PR, CI runs and merge commit in `progress.md` and `verification.md`.
7. Notion Day 12 page:
   - tick the tasks and set Status = Done;
   - add a "Remarks (16 Oct)" section: what shipped, test counts, the Electron/xvfb result, the image-equivalence numbers, deviations, owner actions (R2 receipts bucket + token, BROWSER binding on the account) and what moves to Day 13 (USB/serial drivers, installer, real hardware).
   - Also mark the Day 11 row Done: it's merged as #16 but still shows Not started.

## Risks

- **Scope is large (11 slices).** S1, S2 and S5b are the core. If the day runs over, S6b (upload) slips first, then the cloud renderer (S3); either gets noted in Notion.
- **Electron in a container:** needs xvfb and system libraries. Fallback: `--ozone-platform=headless`; the equivalence test then uses `capturePage` offscreen.
- **Satori/resvg-wasm vs Chromium font metrics:** the image match may need tolerance calibration. The constants are named, and any change is recorded in `verification.md`.
- **Browser Run `quickAction` can't run locally:** covered by the stand-in. The live check is an owner action after the binding is enabled.
- **Owner infra:** the R2 receipts bucket and token for staging. Until they exist, staging grants return 503 and tills retry, by design.

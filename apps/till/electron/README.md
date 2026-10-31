# @shopper/till-electron

Electron shell for the till.

- `src/main.ts` forks the till host (`SHOPPER_TILL_HOST`, default `../../host/dist/server.js`) as
  plain Node with `ELECTRON_RUN_AS_NODE=1` and sends `{type:"start", config, renderer:"parent"}`. The
  config path is the first `.json` argument or `SHOPPER_TILL_CONFIG`. When the host reports `ready`,
  it opens a window on `SHOPPER_TILL_UI_URL` (default `http://127.0.0.1:5174/`) with the bridge
  capability in the URL fragment.
- `src/render.ts` answers the host's `render` messages (`@shopper/hardware/schemas`). A hidden,
  script-less window at the paper's dots width (device scale factor 1) loads `receiptHtml`. PNG uses
  `capturePage`; PDF uses `printToPDF` scaled so 576 dots print as 72 mm, then crops the media box to
  the exact size (Chromium rounds custom page sizes to about 1 pt). Failures reply `render-failed`.
- **Render-only mode:** `SHOPPER_ELECTRON_RENDER_ONLY=1` starts no host. The process answers
  `render` messages on its own Node IPC channel (spawn it with an `ipc` stdio entry) and sends
  `{type:"ready"}` first. Disconnecting the channel quits it. Conformance and equivalence tests use it.

Build with `vp -C apps/till/electron run build` (`dist/main.js`, `electron` external). Tests run it under
`xvfb-run -a` with `--no-sandbox --disable-gpu`; see `docs/engineering/testing.md`.

## Packaging

`vp run till:package -- --win nsis` builds `release/Shopper-Setup-<version>-x64.exe` from the config in
`tooling/build/installer.ts` (written to `release/electron-builder.json`): a one-click, per-user NSIS installer (no
UAC prompt; userData is `%APPDATA%\Shopper`). `--channel pilot|stable` bakes that channel's feed into
`app-update.yml`; `--sign` requires the Azure Trusted Signing environment (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`,
`AZURE_CLIENT_SECRET`, `AZURE_TRUSTED_SIGNING_{ENDPOINT,ACCOUNT,PROFILE,PUBLISHER}`). x64 only:
better-sqlite3-multiple-ciphers 13.0.3 has no win32-ia32 prebuild, and nothing is rebuilt for Electron. There is
no app icon yet (Electron's default) until the designer supplies the mark.

Build-time constants (`tooling/build/info.ts`): `SHOPPER_TILL_UPSTREAM` is the API a fresh install enrols with
(a missing `register.json` is written with it, so the first screen is "Set up this till"); `SHOPPER_TILL_UPDATE_URL`
is the release feed (empty turns `src/updates.ts` off). `vp run till:release` and `vp run till:promote` publish to
it; see `docs/engineering/deployment.md`.

## Runtime files

The till host loads `satori` and `@resvg/resvg-wasm` (including `index_bg.wasm`) from `node_modules` at runtime
when it renders receipt PDFs itself (`tooling/build/server.mjs` marks them external). Any installer must
ship them next to the host (`files`, and `asarUnpack` for the wasm), or the host cannot render without Electron.

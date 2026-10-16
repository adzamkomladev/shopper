# @shopper/till-electron

Electron shell for the till.

- `src/main.ts` forks the till host (`SHOPPER_TILL_HOST`, default `../../host/dist/server.js`) as
  plain Node with `ELECTRON_RUN_AS_NODE=1` and sends `{type:"start", config, renderer:"parent"}`. The
  config path is the first `.json` argument or `SHOPPER_TILL_CONFIG`. When the host reports `ready`,
  it opens a window on `SHOPPER_TILL_UI_URL` (default `http://127.0.0.1:5174/`) with the bridge
  capability in the URL fragment. Installer and USB come on Day 13.
- `src/render.ts` answers the host's `render` messages (`@shopper/hardware/schemas`). A hidden,
  script-less window at the paper's dots width (device scale factor 1) loads `receiptHtml`. PNG uses
  `capturePage`; PDF uses `printToPDF` scaled so 576 dots print as 72 mm, then crops the media box to
  the exact size (Chromium rounds custom page sizes to about 1 pt). Failures reply `render-failed`.
- **Render-only mode:** `SHOPPER_ELECTRON_RENDER_ONLY=1` starts no host. The process answers
  `render` messages on its own Node IPC channel (spawn it with an `ipc` stdio entry) and sends
  `{type:"ready"}` first. Disconnecting the channel quits it. Conformance and equivalence tests use it.

Build with `vp -C apps/till/electron run build` (`dist/main.js`, `electron` external). Tests run it under
`xvfb-run -a` with `--no-sandbox --disable-gpu`; see `docs/engineering/testing.md`.

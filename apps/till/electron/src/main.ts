import { fork } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, nativeTheme } from "electron";
import { openDisplay } from "./display";
import { answerRender } from "./render";
import { loadSecrets } from "./secrets";
import { lockDown } from "./window";

// Chromium must paint at 1 CSS px = 1 device px so a receipt window is exactly `dots` wide.
app.commandLine.appendSwitch("force-device-scale-factor", "1");

const tillUi = process.env.SHOPPER_TILL_UI_URL ?? "http://127.0.0.1:5174/";
// Packaged, tooling/build/package.ts puts the host bundle and the till UI beside this file inside app.asar.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const hostEntry =
  process.env.SHOPPER_TILL_HOST ??
  (app.isPackaged ? here("host/server.js") : here("../../host/dist/server.js"));

// The parent that spawned us over IPC owns our lifetime: when it goes, so do we (and the host).
process.on("disconnect", () => app.quit());
if (process.env.SHOPPER_ELECTRON_RENDER_ONLY === "1") renderOnly();
else
  void app
    .whenReady()
    .then(startRegister)
    .catch((error: unknown) => {
      console.error("Register could not start", error instanceof Error ? error.message : error);
      app.exit(1);
    });

/** Test seam: this process's own Node IPC channel carries renderRequest/renderReply; no host starts. */
function renderOnly() {
  app.on("window-all-closed", () => {});
  void app.whenReady().then(() => {
    process.on(
      "message",
      (message) =>
        void answerRender(message).then(
          (reply) => reply && process.connected && process.send?.(reply),
        ),
    );
    process.send?.({ type: "ready" });
  });
}

/** Forks the till host as plain Node, answers its render requests and shows the till UI once it is ready. */
async function startRegister() {
  Menu.setApplicationMenu(null);
  const userData = app.getPath("userData");
  const configPath =
    process.argv.slice(1).find((arg) => arg.endsWith(".json")) ??
    process.env.SHOPPER_TILL_CONFIG ??
    join(userData, "register.json");
  const stored = JSON.parse(await readFile(configPath, "utf8")) as {
    ui?: string;
    deviceToken?: unknown;
    sqlitePath?: unknown;
  };
  const { v: _version, ...secrets } = await loadSecrets(userData, stored, configPath);
  const config = { ...stored, ...(app.isPackaged && { ui: stored.ui ?? here("ui") }), ...secrets };
  const host = fork(hostEntry, [], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => host.connected && host.disconnect());
  host.on("exit", () => app.quit());
  host.on("message", (message: { type?: string; capability?: string; port?: number } | null) => {
    if (message?.type === "ready" && message.capability)
      openTill(message.capability, config.ui ? `http://127.0.0.1:${message.port}/` : tillUi);
    else if (message?.type === "render")
      void answerRender(message).then((reply) => reply && host.connected && host.send(reply));
  });
  host.send({ type: "start", config, renderer: "parent" });
}

// The till UI draws its own 40px title bar (--card behind, --foreground on it); the OS only paints the window
// controls over its right edge, so there is no preload and no custom window API. The UI follows the OS theme
// (prefers-color-scheme), so the controls do too: light and dark --card / --foreground from @shopper/ui.
const titleBarOverlay = () =>
  nativeTheme.shouldUseDarkColors
    ? { color: "#0b1220", symbolColor: "#f8fafc", height: 40 }
    : { color: "#ffffff", symbolColor: "#020617", height: 40 };

function openTill(capability: string, url: string) {
  const window = new BrowserWindow({
    width: 1366,
    height: 768,
    backgroundColor: titleBarOverlay().color,
    titleBarStyle: "hidden",
    titleBarOverlay: titleBarOverlay(),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  const followTheme = () => window.setTitleBarOverlay(titleBarOverlay());
  nativeTheme.on("updated", followTheme);
  window.once("closed", () => nativeTheme.off("updated", followTheme));
  lockDown(window, new URL(url).origin);
  openDisplay(window, url, capability);
  // The capability stays in the URL fragment, which the till UI reads once and clears.
  void window.loadURL(`${url}#${capability}`);
}

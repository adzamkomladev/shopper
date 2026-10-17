import { fork } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";
import { answerRender } from "./render";

// Chromium must paint at 1 CSS px = 1 device px so a receipt window is exactly `dots` wide.
app.commandLine.appendSwitch("force-device-scale-factor", "1");

const tillUi = process.env.SHOPPER_TILL_UI_URL ?? "http://127.0.0.1:5174/";
const hostEntry =
  process.env.SHOPPER_TILL_HOST ??
  fileURLToPath(new URL("../../host/dist/server.js", import.meta.url));

// The parent that spawned us over IPC owns our lifetime: when it goes, so do we (and the host).
process.on("disconnect", () => app.quit());
if (process.env.SHOPPER_ELECTRON_RENDER_ONLY === "1") renderOnly();
else
  void app
    .whenReady()
    .then(startRegister)
    .catch((error: unknown) => {
      console.error("Register could not start", error);
      app.quit();
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
  const configPath =
    process.argv.slice(1).find((arg) => arg.endsWith(".json")) ?? process.env.SHOPPER_TILL_CONFIG;
  if (!configPath) throw new Error("Usage: electron main.js <private-host-config.json>");
  const config: unknown = JSON.parse(await readFile(configPath, "utf8"));
  const host = fork(hostEntry, [], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => host.connected && host.disconnect());
  host.on("exit", () => app.quit());
  host.on("message", (message: { type?: string; capability?: string } | null) => {
    if (message?.type === "ready" && message.capability) openTill(message.capability);
    else if (message?.type === "render")
      void answerRender(message).then((reply) => reply && host.connected && host.send(reply));
  });
  host.send({ type: "start", config, renderer: "parent" });
}

function openTill(capability: string) {
  const window = new BrowserWindow({
    width: 1366,
    height: 768,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  const origin = new URL(tillUi).origin;
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  });
  // The capability stays in the URL fragment, which the till UI reads once and clears.
  void window.loadURL(`${tillUi}#${capability}`);
}

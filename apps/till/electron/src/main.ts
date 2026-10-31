import { fork } from "node:child_process";
import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, Menu, nativeTheme } from "electron";
import electronUpdater from "electron-updater";
import { buildInfo } from "@shopper/config";
import { startCrashReporting } from "./crash";
import { openDisplay } from "./display";
import { answerRender } from "./render";
import { loadSecrets, writeAtomic } from "./secrets";
import type { UpdatePolicy } from "./types";
import { createUpdates } from "./updates";
import { lockDown } from "./window";

// Chromium must paint at 1 CSS px = 1 device px so a receipt window is exactly `dots` wide.
app.commandLine.appendSwitch("force-device-scale-factor", "1");

const tillUi = process.env.SHOPPER_TILL_UI_URL ?? "http://127.0.0.1:5174/";
// Packaged, tooling/build/package.ts puts the host bundle and the till UI beside this file inside app.asar.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const hostEntry =
  process.env.SHOPPER_TILL_HOST ??
  (app.isPackaged ? here("host/server.js") : here("../../host/dist/server.js"));

// Before anything else, so a failure from here on is reported. These secrets are scrubbed from every event.
const secrets: unknown[] = [];
const crash = startCrashReporting(() => secrets);

// The parent that spawned us over IPC owns our lifetime: when it goes, so do we (and the host).
process.on("disconnect", () => app.quit());
if (process.env.SHOPPER_ELECTRON_RENDER_ONLY === "1") renderOnly();
else
  void app
    .whenReady()
    .then(startRegister)
    .catch((error: unknown) => fail("Register could not start", error));

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
  const text = await readFile(configPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return firstRun(configPath, userData);
  });
  let stored: { ui?: string; deviceToken?: unknown; sqlitePath?: unknown; identity?: unknown };
  try {
    stored = JSON.parse(text);
  } catch {
    // V8's message quotes the JSON around the fault, which may be the device token.
    throw new Error(`${configPath} is not valid JSON`);
  }
  // A fresh install has no identity yet: the host enrols it, then the token is sealed like any other.
  const prepare = async (register: typeof stored) => {
    const ui = app.isPackaged && { ui: register.ui ?? here("ui") };
    if (register.identity === undefined) return { ...register, ...ui };
    const { v: _version, ...sealed } = await loadSecrets(userData, register, configPath);
    return { ...register, ...ui, ...sealed };
  };
  const config = await prepare(stored);
  secrets.push(config.deviceToken, "databaseKey" in config && config.databaseKey);
  if (config.identity)
    crash.tag("register", (config.identity as { registerName: string }).registerName);
  const host = fork(hostEntry, [], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
  // No feed configured (dev, tests) means no updater: nothing phones home.
  const updates = buildInfo.tillUpdateUrl ? startUpdates(host) : undefined;
  app.on("window-all-closed", () => app.quit());
  let quitting = false;
  let ready = false;
  let cause: string | undefined;
  app.on("before-quit", () => {
    quitting = true;
    if (host.connected) host.disconnect();
  });
  // `close` waits for the IPC channel, so the host's error message has already arrived.
  host.on("close", (code, signal) => {
    if (quitting || code === 0) app.quit();
    else
      fail(
        ready ? "Register stopped" : "Register could not start",
        cause ?? `The register host stopped (${code ?? signal})`,
      );
  });
  host.on(
    "message",
    (
      message:
        | ({
            type?: string;
            capability?: string;
            port?: number;
            message?: string;
            registration?: object;
          } & Partial<UpdatePolicy>)
        | null,
    ) => {
      if (message?.type === "error" && !ready) cause = message.message;
      else if (message?.type === "update-policy") {
        crash.tag("channel", (message as UpdatePolicy).channel);
        updates?.policy(message as UpdatePolicy);
      } else if (message?.type === "update-install") updates?.install();
      else if (message?.type === "enrolled" && message.registration)
        void enrol(message.registration).catch((error: unknown) => fail("Register stopped", error));
      else if (message?.type === "ready" && message.capability) {
        // After enrolment the host comes back on the same port and capability; the open window reconnects.
        if (ready) return;
        ready = true;
        secrets.push(message.capability);
        openTill(message.capability, config.ui ? `http://127.0.0.1:${message.port}/` : tillUi);
      } else if (message?.type === "render")
        void answerRender(message).then((reply) => reply && host.connected && host.send(reply));
    },
  );
  host.send({ type: "start", config, renderer: "parent" });

  /** Stores what the host enrolled with, seals its token and starts the host as an enrolled till. */
  async function enrol(registration: object) {
    const register = { ...stored, ...registration, session: null };
    await writeAtomic(configPath, JSON.stringify(register, null, 2));
    host.send({ type: "start", config: await prepare(register), renderer: "parent" });
  }
}

/**
 * A fresh install has no register file: write the install half of one, and the host starts as an enrolment host
 * on the "Set up this till" screen. The packaged app serves its own UI, so it needs no other origin.
 */
async function firstRun(configPath: string, userData: string) {
  const upstream = process.env.SHOPPER_TILL_UPSTREAM ?? buildInfo.tillUpstream;
  if (!upstream)
    throw new Error("This build names no server to enrol with (SHOPPER_TILL_UPSTREAM)");
  const origins = app.isPackaged ? [] : [new URL(tillUi).origin];
  const text = JSON.stringify(
    { upstream, sqlitePath: join(userData, "register.sqlite"), origins, port: 0 },
    null,
    2,
  );
  await writeAtomic(configPath, text);
  return text;
}

/** electron-updater on the build's feed; the host hears every state change and folds it into its status. */
function startUpdates(host: ReturnType<typeof fork>) {
  const updater = electronUpdater.autoUpdater;
  // An unpackaged build checks too when a feed is set, so a dev can run it against a local feed.
  updater.forceDevUpdateConfig = !app.isPackaged;
  const updates = createUpdates(updater, buildInfo.tillUpdateUrl, (state) => {
    if (host.connected) host.send({ type: "update-state", ...state });
  });
  app.once("before-quit", updates.stop);
  return updates;
}

/**
 * A packaged register is a GUI app with no console, so the cause goes to `userData/register.log` and a
 * native dialog before exiting non-zero. Causes are secret-free: the host masks secrets in its own.
 */
function fail(title: string, error: unknown) {
  const cause = error instanceof Error ? error.message : String(error);
  const log = join(app.getPath("userData"), "register.log");
  const body = `${cause}

This is saved in ${log}`;
  console.error(`${title}: ${body}`);
  try {
    appendFileSync(
      log,
      `${new Date().toISOString()} ${title}: ${cause}
`,
    );
  } catch {
    // The dialog still tells the operator; a log that cannot be written must not hide it.
  }
  if (app.isPackaged || process.env.SHOPPER_TEST_NO_DIALOG !== "1")
    dialog.showErrorBox(title, body);
  void crash.report(title, cause).finally(() => app.exit(1));
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

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeExternals as externals } from "./externals.mjs";
import { buildDefines } from "./info.ts";
import { installerConfig } from "./installer.ts";

// Packages the desktop register: `vp run till:package -- --linux dir` or `-- --win nsis` (NSIS needs Windows).
// `--channel pilot|stable` (default stable) picks the feed baked into app-update.yml; `--sign` requires the Azure
// Trusted Signing environment (installer.ts), which also signs without the flag whenever it is all there.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const electronApp = resolve(root, "apps/till/electron");
const stage = resolve(electronApp, ".app");
const run = (command: string, args: string[], cwd = root) =>
  execFileSync(command, args, { cwd, stdio: "inherit" });
const manifest = (path: string) => JSON.parse(readFileSync(resolve(root, path), "utf8"));

// These load from node_modules at runtime (externals.mjs), so the stage installs them.
const declared = Object.assign(
  {},
  ...["apps/till/host", "apps/till/electron"].map(
    (dir) => manifest(`${dir}/package.json`).dependencies,
  ),
);

run("vp", ["-C", "apps/till/ui", "exec", "vp", "build"]);
for (const bundle of ["till-host", "till-electron"])
  run("vp", [
    "-C",
    `apps/till/${bundle.slice(5)}`,
    "exec",
    "node",
    "../../../tooling/build/server.mjs",
    bundle,
  ]);

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage);
cpSync(resolve(electronApp, "dist/main.js"), resolve(stage, "main.js"));
cpSync(resolve(root, "apps/till/host/dist"), resolve(stage, "host"), { recursive: true });
cpSync(resolve(root, "apps/till/ui/dist"), resolve(stage, "ui"), { recursive: true });
writeFileSync(
  resolve(stage, "package.json"),
  JSON.stringify({
    name: "shopper-register",
    // Electron names userData after productName (%APPDATA%\Shopper), where till:provision writes.
    productName: "Shopper",
    version: JSON.parse(buildDefines.SHOPPER_VERSION),
    description: "Shopper register",
    author: "Shopper",
    main: "main.js",
    type: "module",
    dependencies: Object.fromEntries(externals.map((name) => [name, declared[name]])),
  }),
);
run("pnpm", ["install", "--ignore-workspace", "--prod", "--ignore-scripts"], stage);

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const channelAt = args.indexOf("--channel");
const channel = channelAt >= 0 ? args.splice(channelAt, 2)[1] : "stable";
if (channel !== "pilot" && channel !== "stable") throw new Error("--channel is pilot or stable");
const signAt = args.indexOf("--sign");
if (signAt >= 0) args.splice(signAt, 1);
const config = resolve(electronApp, "release/electron-builder.json");
mkdirSync(dirname(config), { recursive: true });
writeFileSync(
  config,
  JSON.stringify(
    installerConfig({
      channel,
      sign: signAt >= 0,
      feed: JSON.parse(buildDefines.TILL_UPDATE_URL),
      env: process.env,
    }),
  ),
);

const load = createRequire(resolve(electronApp, "package.json"));
const electronDist = dirname(load("electron") as string);
const electronVersion = manifest("apps/till/electron/package.json").dependencies.electron;
// The CLI script through Node: Windows cannot exec the extensionless `.bin` shim without a shell.
run(process.execPath, [
  load.resolve("electron-builder/cli.js"),
  "--projectDir",
  stage,
  "--config",
  config,
  `-c.electronDist=${electronDist}`,
  `-c.electronVersion=${electronVersion}`,
  `-c.directories.output=${resolve(electronApp, "release")}`,
  ...args,
]);

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeExternals as externals } from "./externals.mjs";
import { buildDefines } from "./info.ts";

// Packages the desktop register: `vp run till:package -- --linux dir` or `-- --win nsis` (NSIS needs Windows).
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
    version: JSON.parse(buildDefines.SHOPPER_VERSION),
    description: "Shopper register",
    author: "Shopper",
    main: "main.js",
    type: "module",
    dependencies: Object.fromEntries(externals.map((name) => [name, declared[name]])),
  }),
);
run("pnpm", ["install", "--ignore-workspace", "--prod", "--ignore-scripts"], stage);

const electronDist = dirname(
  createRequire(resolve(electronApp, "package.json"))("electron") as string,
);
const electronVersion = manifest("apps/till/electron/package.json").dependencies.electron;
run(resolve(electronApp, "node_modules/.bin/electron-builder"), [
  "--projectDir",
  stage,
  "--config",
  resolve(electronApp, "electron-builder.yml"),
  `-c.electronDist=${electronDist}`,
  `-c.electronVersion=${electronVersion}`,
  `-c.directories.output=${resolve(electronApp, "release")}`,
  ...process.argv.slice(2).filter((arg) => arg !== "--"),
]);

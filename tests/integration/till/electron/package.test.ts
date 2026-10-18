import { execFileSync, spawn } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { stopElectron } from "../../../support/hardware/electron";
import { healthy, register } from "../../../support/hardware/register";

const built = resolve("apps/till/electron/release/linux-unpacked");
// A copy outside the repo, so a bare import the package forgot to install cannot resolve from the repo's node_modules.
let unpacked = "";
let resources = "";
let copy = "";
const cleanup: Array<() => Promise<void>> = [];

beforeAll(async () => {
  execFileSync("vp", ["exec", "tsx", "tooling/build/package.ts", "--linux", "dir"], {
    stdio: "pipe",
    maxBuffer: 64 * 1024 * 1024,
  });
  copy = await mkdtemp(join(tmpdir(), "shopper-packaged-"));
  unpacked = join(copy, "linux-unpacked");
  resources = join(unpacked, "resources");
  await cp(built, unpacked, { recursive: true });
}, 600_000);
afterAll(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
  if (copy) await rm(copy, { recursive: true, force: true });
});

test("every native module and wasm file is unpacked from app.asar", async () => {
  const native = (await readdir(resources, { recursive: true })).filter((file) =>
    /\.(node|wasm)$/.test(file),
  );
  expect(native.length).toBeGreaterThan(0);
  for (const file of native) expect(file, file).toContain("app.asar.unpacked");
}, 60_000);

test("the packaged app starts the host from the asar, serves its UI and opens an encrypted database", async () => {
  const { userData, port, sqlitePath } = await register(cleanup);
  // The packaged app defaults `ui` to the UI inside app.asar.
  const configPath = join(userData, "register.json");
  const { ui: _ui, ...config } = JSON.parse(await readFile(configPath, "utf8"));
  await writeFile(configPath, JSON.stringify(config));
  const child = spawn(
    "xvfb-run",
    [
      "-a",
      join(unpacked, "shopper-register"),
      "--no-sandbox",
      "--disable-gpu",
      `--user-data-dir=${userData}`,
      "--password-store=basic",
    ],
    {
      detached: true,
      env: { ...process.env, SHOPPER_INSECURE_SECRETS: "1" },
      stdio: "ignore",
    },
  );
  cleanup.push(() => stopElectron(child));
  await healthy(port);
  expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toContain("Shopper till-ui");
  await stopElectron(child);
  expect((await readFile(sqlitePath)).subarray(0, 15).toString()).not.toBe("SQLite format 3");
}, 180_000);

test("satori and resvg render a PNG from the unpacked files", async () => {
  const font = resolve(
    "apps/till/ui/node_modules/@fontsource/geist/files/geist-latin-400-normal.woff",
  );
  const script = `
    const { createRequire } = require("node:module");
    const { readFileSync } = require("node:fs");
    (async () => {
      const load = createRequire(${JSON.stringify(join(resources, "app.asar/package.json"))});
      const satori = load("satori").default ?? load("satori");
      const { Resvg, initWasm } = load("@resvg/resvg-wasm");
      const svg = await satori(
        { type: "div", props: { children: "Receipt", style: { display: "flex", width: 200, height: 40 } } },
        { width: 200, height: 40, fonts: [{ name: "Geist", data: readFileSync(${JSON.stringify(font)}), weight: 400, style: "normal" }] },
      );
      await initWasm(readFileSync(load.resolve("@resvg/resvg-wasm/index_bg.wasm")));
      const png = new Resvg(svg).render().asPng();
      console.log(JSON.stringify([...png.subarray(0, 4)]));
    })().catch((error) => { console.error(error); process.exit(1); });`;
  const output = execFileSync(join(unpacked, "shopper-register"), ["-e", script], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  }).toString();
  expect(JSON.parse(output.trim().split("\n").at(-1)!)).toEqual([137, 80, 78, 71]);
}, 60_000);

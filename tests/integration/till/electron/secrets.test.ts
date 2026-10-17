import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { launchElectron, stopElectron } from "../../../support/hardware/electron";

const deviceToken = "a".repeat(64);
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function register() {
  const directory = await mkdtemp(join(tmpdir(), "shopper-secrets-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const ui = join(directory, "ui");
  await mkdir(ui);
  await writeFile(join(ui, "index.html"), "<title>till</title>");
  const port = await freePort();
  const userData = join(directory, "user-data");
  await mkdir(userData);
  await writeFile(
    join(userData, "register.json"),
    JSON.stringify({
      sqlitePath: join(directory, "till.sqlite"),
      identity: {
        orgId: "0197b0a0-0000-7000-8000-000000000001",
        deviceId: "0197b0a0-0000-7000-8000-000000000002",
        storeId: "0197b0a0-0000-7000-8000-000000000003",
        branchId: "0197b0a0-0000-7000-8000-000000000004",
        shopName: "Secret shop",
        registerName: "Register 1",
      },
      upstream: "http://127.0.0.1:9",
      deviceToken,
      session: null,
      origins: ["http://127.0.0.1:5174"],
      ui,
      port,
    }),
  );
  const start = async (extra: string[] = []) => {
    const child = await launchElectron({}, [
      `--user-data-dir=${userData}`,
      ...(extra.length ? extra : ["--password-store=basic"]),
    ]);
    cleanup.push(() => stopElectron(child));
    return child;
  };
  return { directory, userData, port, start, sqlitePath: join(directory, "till.sqlite") };
}

async function healthy(port: number) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const ok = await fetch(`http://127.0.0.1:${port}/health`).then(
      (response) => response.ok,
      () => false,
    );
    if (ok) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error("The register host never became healthy");
}

function freePort() {
  return new Promise<number>((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

test("first start seals a fresh database key and the device token and strips the token from register.json", async () => {
  const { userData, port, start, sqlitePath } = await register();
  const child = await start();
  await healthy(port);
  const sealed = await readFile(join(userData, "register.secret"));
  expect((await stat(join(userData, "register.secret"))).mode & 0o777).toBe(0o600);
  expect(sealed.toString("latin1")).not.toContain(deviceToken);
  const config = await readFile(join(userData, "register.json"), "utf8");
  expect(config).not.toContain("deviceToken");
  expect(config).not.toContain(deviceToken);
  // The served UI loads, and the database on disk is encrypted (no plain SQLite header).
  expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe("<title>till</title>");
  await stopElectron(child);
  expect((await readFile(sqlitePath)).subarray(0, 15).toString()).not.toBe("SQLite format 3");
}, 120_000);

test("a restart reopens the encrypted database with the sealed key", async () => {
  const { userData, port, start } = await register();
  const first = await start();
  await healthy(port);
  await stopElectron(first);
  const secret = await readFile(join(userData, "register.secret"));
  await start();
  await healthy(port);
  expect(await readFile(join(userData, "register.secret"))).toEqual(secret);
}, 180_000);

test("the app refuses to start when OS encryption is unavailable", async () => {
  const { port, start } = await register();
  const child = await start(["--no-first-run"]);
  const output: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  const code = await new Promise<number | null>((done) => child.once("close", done));
  expect(code).not.toBe(0);
  expect(output.join(""), `exit ${code}`).toContain("OS encryption is unavailable");
  await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
}, 90_000);

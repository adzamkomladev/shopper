import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { stopElectron } from "../../../support/hardware/electron";
import { deviceToken, healthy, register } from "../../../support/hardware/register";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("first start seals a fresh database key and the device token and strips the token from register.json", async () => {
  const { userData, port, start, sqlitePath } = await register(cleanup);
  const child = await start();
  await healthy(port);
  const sealed = await readFile(join(userData, "register.secret"));
  if (process.platform !== "win32")
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
  const { userData, port, start } = await register(cleanup);
  const first = await start();
  await healthy(port);
  await stopElectron(first);
  const secret = await readFile(join(userData, "register.secret"));
  await start();
  await healthy(port);
  expect(await readFile(join(userData, "register.secret"))).toEqual(secret);
}, 180_000);

test("the app refuses to start when OS encryption is unavailable", async () => {
  const { port, start } = await register(cleanup);
  const child = await start([], { SHOPPER_TEST_NO_ENCRYPTION: "1" });
  const output: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  const code = await new Promise<number | null>((done) => child.once("close", done));
  expect(code).not.toBe(0);
  expect(output.join(""), `exit ${code}`).toContain("OS encryption is unavailable");
  await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
}, 90_000);

test.each([
  [
    "a re-enrolled token in register.json replaces the sealed token and is scrubbed",
    "b".repeat(64),
    true,
  ],
  ["a crash after sealing still scrubs the token on the next start", deviceToken, false],
])(
  "%s",
  async (_name, token, resealed) => {
    const { userData, port, start } = await register(cleanup);
    const first = await start();
    await healthy(port);
    await stopElectron(first);
    const before = await readFile(join(userData, "register.secret"));
    const configPath = join(userData, "register.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    await writeFile(configPath, JSON.stringify({ ...config, deviceToken: token }));
    await start();
    await healthy(port);
    expect(await readFile(configPath, "utf8")).not.toContain("deviceToken");
    const after = await readFile(join(userData, "register.secret"));
    expect(after.equals(before)).toBe(!resealed);
  },
  180_000,
);

test.runIf(process.platform === "win32")(
  "on Windows DPAPI wraps the key, and a register.secret copied to another profile is refused",
  async () => {
    const original = await register(cleanup);
    const first = await original.start();
    await healthy(original.port);
    await stopElectron(first);
    // Chromium's os_crypt key in Local State is sealed for this Windows user by DPAPI.
    const state = JSON.parse(await readFile(join(original.userData, "Local State"), "utf8"));
    const key = Buffer.from(state.os_crypt.encrypted_key, "base64");
    expect(key.subarray(0, 5).toString()).toBe("DPAPI");

    const other = await register(cleanup);
    await copyFile(
      join(original.userData, "register.secret"),
      join(other.userData, "register.secret"),
    );
    const child = await other.start();
    const output: string[] = [];
    child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
    const code = await new Promise<number | null>((done) => child.once("close", done));
    expect(code).not.toBe(0);
    expect(output.join(""), `exit ${code}`).toContain("register.secret is unreadable");
  },
  180_000,
);

// First run on a shop LAN finds the box (shopper.local) before the build's cloud; a cashier can type the box's
// address when mDNS is blocked. Either way only a box that hands over a CA is pinned.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createServer as listenTcp } from "node:net";
import { join } from "node:path";
import { moveServer } from "@shopper/till-electron/register";
import { changeServer, findServer } from "@shopper/till-electron/trust";
import { startPinnedBox } from "../../../support/till/box";

let box: Awaited<ReturnType<typeof startPinnedBox>>;
let dir: string;
let upstream: string;
beforeAll(async () => {
  box = await startPinnedBox();
  dir = box.dir;
  upstream = box.upstream;
});
afterAll(async () => box?.close());

const cloud = "https://shopper-api.temtem.dev";

// First run on a shop LAN: a box that hands over its CA is the server; anything else leaves the build's cloud.
test("first run enrols with a box that answers, and falls back to the cloud when none does", async () => {
  await box!.serve("ca.crt");
  expect(await findServer(upstream, cloud, dir)).toEqual({
    upstream,
    ca: join(dir, "box-ca.pem"),
  });
  await rm(join(dir, "box-ca.pem"));
  expect(await findServer("https://127.0.0.1:1", cloud, dir)).toEqual({ upstream: cloud });
  // A name that answers with a leaf is not a box: nothing is pinned.
  await box!.serve("leaf.crt");
  expect(await findServer(upstream, cloud, dir)).toEqual({ upstream: cloud });
  await expect(readFile(join(dir, "box-ca.pem"))).rejects.toThrow();
});

test("a box that accepts the connection but never answers costs at most a few seconds", async () => {
  const silent = listenTcp(() => {});
  await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
  const started = Date.now();
  const found = await findServer(
    `https://127.0.0.1:${(silent.address() as { port: number }).port}`,
    cloud,
    dir,
  );
  silent.close();
  expect(found).toEqual({ upstream: cloud });
  expect(Date.now() - started).toBeLessThan(4_500);
});

// When mDNS is blocked the cashier types the box's address on the enrol screen.
test("a typed box address is pinned; a public name or a silent address is refused with why", async () => {
  await box!.serve("ca.crt");
  const port = new URL(upstream).port;
  expect(await changeServer(` 127.0.0.1:${port} `, dir)).toEqual({
    upstream,
    ca: join(dir, "box-ca.pem"),
  });
  expect(await changeServer(`https://127.0.0.1:${port}/`, dir)).toMatchObject({ upstream });
  await expect(changeServer("kumasi-mart.com", dir)).rejects.toThrow(/like 192\.168\.1\.20/);
  await expect(changeServer("not an address", dir)).rejects.toThrow(/like 192\.168\.1\.20/);
  await expect(changeServer("127.0.0.1:1", dir)).rejects.toThrow(
    /Nothing answered at 127\.0\.0\.1:1/,
  );
  await box!.serve("leaf.crt");
  await expect(changeServer(`127.0.0.1:${port}`, dir)).rejects.toThrow(/not a Shopper box/);
});

test("a typed box replaces the register file's server before enrolment, never after", async () => {
  await box!.serve("ca.crt");
  const path = join(dir, "register.json");
  const install = {
    upstream: "https://shopper-api.temtem.dev",
    sqlitePath: "r.sqlite",
    origins: [],
    port: 0,
  };
  await writeFile(path, JSON.stringify(install));
  await moveServer(path, dir, new URL(upstream).host);
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
    ...install,
    upstream,
    ca: join(dir, "box-ca.pem"),
  });
  await writeFile(path, JSON.stringify({ ...install, identity: { registerName: "Till 1" } }));
  await expect(moveServer(path, dir, new URL(upstream).host)).rejects.toThrow(/already enrolled/);
  expect(JSON.parse(await readFile(path, "utf8")).upstream).toBe(install.upstream);
});

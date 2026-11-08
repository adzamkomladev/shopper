// The root helper switches the box to the spare slot, and switches back when the new one is not healthy.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chmod, mkdir, readFile, readlink, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { boxTree } from "../../support/box/updates";

let server: Server;
let healthy = true;
let url: string;
beforeAll(async () => {
  server = createServer((_request, response) => response.writeHead(healthy ? 200 : 500).end("{}"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/health`;
});
afterAll(() => server.close());

async function tree() {
  const t = await boxTree();
  await mkdir(join(t.root, "slots", "b"));
  await writeFile(join(t.root, "slots", "b", "shopper-box"), "box 1.1.0");
  await chmod(join(t.root, "slots", "b", "shopper-box"), 0o755);
  const log = join(t.root, "systemctl.log");
  const fake = join(t.root, "systemctl");
  await writeFile(fake, `#!/bin/sh\necho "$@" >> ${log}\n`);
  await chmod(fake, 0o755);
  return { ...t, log, fake };
}
const request = (t: { updates: string }, slot: string) =>
  writeFile(
    join(t.updates, "apply.json"),
    JSON.stringify({ slot, version: "1.1.0", file: "ok.tgz" }),
  );
// Async: the health server is in this process and must answer while the helper waits for it.
async function apply(t: { root: string; updates: string; fake: string }) {
  await promisify(execFile)("sh", [join(process.cwd(), "apps/box/deploy/bin/shopper-apply")], {
    env: {
      PATH: process.env.PATH ?? "",
      SHOPPER_ROOT: t.root,
      SHOPPER_UPDATES_DIR: t.updates,
      SHOPPER_SYSTEMCTL: t.fake,
      SHOPPER_HEALTH_URL: url,
      SHOPPER_HEALTH_SECONDS: "2",
    },
  }).catch(() => undefined); // a rollback exits 1 on purpose
}
const result = async (t: { updates: string }) =>
  JSON.parse(await readFile(join(t.updates, "result.json"), "utf8")) as {
    status: string;
    message: string;
  };

test("a healthy new slot becomes current; an unhealthy one is switched back and says so", async () => {
  const good = await tree();
  healthy = true;
  await request(good, "b");
  await apply(good);
  expect((await readlink(join(good.root, "current"))).endsWith("slots/b")).toBe(true);
  expect((await result(good)).status).toBe("applied");
  // The box was stopped, started on the new slot, and the request is consumed.
  // The engine runs from the same slot, so it switches with the box.
  expect((await readFile(good.log, "utf8")).trim().split("\n")).toEqual([
    "stop shopper-box",
    "stop shopper-engine",
    "start shopper-engine",
    "start shopper-box",
  ]);
  await expect(readFile(join(good.updates, "apply.json"))).rejects.toThrow();

  const bad = await tree();
  healthy = false;
  await request(bad, "b");
  await apply(bad);
  expect((await readlink(join(bad.root, "current"))).endsWith("slots/a")).toBe(true);
  const rolled = await result(bad);
  expect(rolled.status).toBe("rolled_back");
  expect(rolled.message).toContain("restore the backup");
  expect((await readFile(bad.log, "utf8")).trim().split("\n")).toEqual([
    "stop shopper-box",
    "stop shopper-engine",
    "start shopper-engine",
    "start shopper-box",
    "stop shopper-box",
    "stop shopper-engine",
    "start shopper-engine",
    "start shopper-box",
  ]);
});

test("a request for the slot already running, or for no slot, changes nothing", async () => {
  const t = await tree();
  await request(t, "a");
  await apply(t);
  expect((await result(t)).status).toBe("failed");
  await request(t, "../x");
  await apply(t);
  expect((await result(t)).status).toBe("failed");
  expect((await readlink(join(t.root, "current"))).endsWith("slots/a")).toBe(true);
  await expect(readFile(t.log)).rejects.toThrow();
});

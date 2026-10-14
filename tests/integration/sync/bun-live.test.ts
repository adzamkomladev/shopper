import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { expect, test } from "vite-plus/test";
import { createDeviceService } from "@shopper/auth/devices";
import { mutateManagement } from "@shopper/core/management";
import { createProduct } from "@shopper/core/catalogue";
import { buildDefines } from "../../../tooling/build/info";
import { auth, baseURL, context, cookies, db, deviceCache, fixture, secret } from "../auth/setup";

const exec = promisify(execFile);

test("the Bun box authenticates live upgrades and sends a committed API price change over its shared hub", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shopper-bun-live-"));
  const entry = join(directory, "server.ts");
  const output = join(directory, "server.js");
  const appPath = new URL("../../../apps/box/src/server.ts", import.meta.url).pathname;
  await writeFile(
    entry,
    `import config from ${JSON.stringify(appPath)};
const server = Bun.serve({ ...config, hostname: "127.0.0.1", port: 0 });
console.log(JSON.stringify({ port: server.port }));`,
  );
  await exec("bun", [
    "build",
    entry,
    "--target=bun",
    `--outfile=${output}`,
    ...Object.entries(buildDefines).map(([key, value]) => `--define=${key}=${value}`),
  ]);
  const child = spawn("bun", [output], {
    env: {
      ...process.env,
      DATABASE_URL: fixture.connectionString,
      SHOPPER_AUTH_SECRET: secret,
      SHOPPER_AUTH_URL: baseURL,
      SHOPPER_ORG_ID: context.orgId,
      SHOPPER_CACHE_PATH: join(directory, "cache.sqlite"),
      SHOPPER_BLOBS_PATH: join(directory, "blobs"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout });
  let errors = "";
  child.stderr.on("data", (data) => {
    errors += String(data);
  });
  let socket: WebSocket | undefined;
  try {
    const ready = await Promise.race([
      once(lines, "line").then(([line]) => JSON.parse(String(line)) as { port: number }),
      once(child, "exit").then(() => {
        throw new Error(errors || "Bun server exited before ready");
      }),
    ]);
    const upstream = `http://127.0.0.1:${ready.port}`;
    const owner = await auth.resolvePrincipal(
      new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
    );
    if (!owner) throw new Error("Expected fixture owner");
    const store = await mutateManagement(db, context, {
      kind: "store",
      action: "create",
      data: { name: "Bun live" },
    });
    const branch = await mutateManagement(db, context, {
      kind: "branch",
      action: "create",
      data: { name: "Bun live", storeId: store.id },
    });
    const devices = createDeviceService(db, deviceCache.cache, context.appVersion, context.orgId);
    const challenge = await devices.issueEnrollment(owner, { branchId: branch.id });
    const enrolled = await devices.enroll({
      orgId: context.orgId,
      code: challenge.code,
      name: "Bun live",
    });
    expect((await fetch(`${upstream}/sync/live`)).status).toBe(401);
    socket = new WebSocket(`${upstream.replace("http:", "ws:")}/sync/live?cursor=0`, {
      headers: {
        authorization: `Bearer ${enrolled.deviceToken}`,
        "X-Shopper-Device": enrolled.deviceId,
      },
    });
    await once(socket, "open");
    const product = await createProduct(db, context, {
      sku: "BUN-LIVE",
      name: "Bun live",
      baseUnit: "each",
      taxClass: "standard",
    });
    const received = once(socket, "message");
    const started = performance.now();
    const changed = await fetch(`${upstream}/products/${product.id}/prices`, {
      method: "POST",
      headers: { cookie: cookies.get("superadmin")!, "content-type": "application/json" },
      body: JSON.stringify({ amount: 14000, reason: "Bun realtime verification" }),
    });
    expect(changed.status, await changed.text()).toBe(201);
    const [message] = await received;
    expect(JSON.parse(String(message))).toEqual({
      type: "store.changed",
      sequence: expect.any(String),
    });
    expect(performance.now() - started).toBeLessThan(1000);
  } finally {
    socket?.terminate();
    lines.close();
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);

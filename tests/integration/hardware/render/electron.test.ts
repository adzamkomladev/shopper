import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import type { Json } from "@shopper/ports";
import { rendererConformance } from "@shopper/conformance";
import { goldenReceipt } from "../../../support/hardware/receipt";
import {
  buildElectron,
  electronRenderer,
  launchElectron,
  stopElectron,
} from "../../../support/hardware/electron";

const receipt = goldenReceipt() as unknown as Json;

rendererConformance("electron renderer", test, () => electronRenderer(receipt));

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("Electron starts the real host in parent-renderer mode and opens the till window", async () => {
  await buildElectron();
  const directory = await mkdtemp(join(tmpdir(), "shopper-electron-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  let requested!: (url: string) => void;
  const opened = new Promise<string>((resolve) => (requested = resolve));
  const ui = createServer((request, response) => {
    response.end("<!doctype html><title>till</title>");
    requested(request.url ?? "");
  });
  await new Promise<void>((done) => ui.listen(0, "127.0.0.1", done));
  cleanup.push(() => new Promise((done) => ui.close(() => done())));
  const port = (ui.address() as { port: number }).port;
  const configPath = join(directory, "host.json");
  await writeFile(
    configPath,
    JSON.stringify({
      sqlitePath: join(directory, "till.sqlite"),
      identity: {
        orgId: "0197b0a0-0000-7000-8000-000000000001",
        deviceId: "0197b0a0-0000-7000-8000-000000000002",
        storeId: "0197b0a0-0000-7000-8000-000000000003",
        branchId: "0197b0a0-0000-7000-8000-000000000004",
        shopName: "Electron shop",
        registerName: "Register 1",
      },
      upstream: "http://127.0.0.1:9",
      deviceToken: "a".repeat(64),
      session: null,
      origins: [`http://127.0.0.1:${port}`],
      port: 0,
    }),
  );
  const child = await launchElectron({ SHOPPER_TILL_UI_URL: `http://127.0.0.1:${port}/` }, [
    configPath,
    `--user-data-dir=${join(directory, "user-data")}`,
    "--password-store=basic",
  ]);
  cleanup.push(() => stopElectron(child));
  // The capability travels in the URL fragment, which a server never sees.
  expect(await opened).toBe("/");
}, 90_000);

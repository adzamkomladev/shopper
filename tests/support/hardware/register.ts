import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchElectron, stopElectron } from "./electron";

export const deviceToken = "a".repeat(64);

/** A register.json + served UI in a temp dir; `start` launches Electron on it and stops it with `cleanup`. */
export async function register(cleanup: Array<() => Promise<void>>) {
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
  const start = async (extra: string[] = [], env: Record<string, string> = {}) => {
    const child = await launchElectron(env, [
      `--user-data-dir=${userData}`,
      ...(extra.length ? extra : ["--password-store=basic"]),
    ]);
    cleanup.push(() => stopElectron(child));
    return child;
  };
  return { directory, userData, port, start, sqlitePath: join(directory, "till.sqlite") };
}

export async function healthy(port: number) {
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

import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sealBox } from "../../../tooling/box/seal";

/** A tiny portal build: enough to prove the shell and an asset come out of the binary. */
export async function sealedBox(env?: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), "shopper-sealed-"));
  const portal = join(dir, "portal");
  await mkdir(join(portal, "assets"), { recursive: true });
  await writeFile(join(portal, "index.html"), "<!doctype html><title>Sealed portal</title>");
  await writeFile(join(portal, "assets", "app-9f8e.js"), "export const sealed = true;");
  const built = join(dir, "build", "shopper-box");
  await sealBox({ portal, out: built, env });
  return {
    dir,
    /** A copy in a folder of its own, so nothing beside the binary can be what it runs from. */
    async install() {
      const home = await mkdtemp(join(dir, "install-"));
      const binary = join(home, "shopper-box");
      await copyFile(built, binary);
      return { home, binary };
    },
    close: () => rm(dir, { recursive: true, force: true }),
  };
}

export async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** Runs the binary the way systemd does: its own folder as the working directory, only the given environment. */
export async function startSealed(
  install: { home: string; binary: string },
  env: Record<string, string>,
) {
  const port = env.PORT ?? (await freePort());
  const output: string[] = [];
  const child = spawn(install.binary, [], {
    cwd: install.home,
    env: { PATH: process.env.PATH ?? "", PORT: String(port), ...env },
  });
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));
  const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`The box exited: ${output.join("")}`);
    if ((await fetch(`${url}/api/health`).catch(() => undefined))?.ok) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return {
    url,
    output: () => output.join(""),
    async stop() {
      child.kill("SIGTERM");
      await exited;
    },
    /** A power cut: no shutdown hook runs. */
    async kill() {
      child.kill("SIGKILL");
      await exited;
    },
  };
}

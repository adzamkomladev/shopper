import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packFolders } from "../../apps/box/src/pack";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Seals the box: the bundled entry (`src/main.ts`), the database migrations and the portal's static files compiled
 * into one Bun executable with bytecode. `vp run box:seal [--portal <dir>] [--out <file>]`.
 */
export async function sealBox(options: {
  portal: string;
  out: string;
  /** Build defines for this binary, such as `SHOPPER_RELEASE_KEY`. */
  env?: Record<string, string>;
}) {
  // The stage sits inside apps/box so the bundle's bare imports (satori, resvg) resolve from its node_modules.
  const stage = join(root, "apps/box/dist/seal");
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  execFileSync("node", [join(root, "tooling/build/server.mjs"), "box-sealed"], {
    cwd: join(root, "apps/box"),
    stdio: "inherit",
    env: { ...process.env, ...options.env, SHOPPER_BUILD_OUT_DIR: stage },
  });
  await writeFile(
    join(stage, "payload.bin"),
    await packFolders({
      migrations: join(root, "packages/db/pg/migrations"),
      portal: options.portal,
    }),
  );
  await mkdir(dirname(options.out), { recursive: true });
  // payload.bin keeps its name so the binary finds it among Bun.embeddedFiles.
  execFileSync(
    "bun",
    [
      "build",
      "--compile",
      "--bytecode",
      "--asset-naming=[name].[ext]",
      "./main.js",
      "./payload.bin",
      "--outfile",
      resolve(options.out),
    ],
    { cwd: stage, stdio: "inherit" },
  );
  await rm(stage, { recursive: true, force: true });
}

if (import.meta.main) {
  const flag = (name: string) => process.argv[process.argv.indexOf(name) + 1];
  await sealBox({
    portal: resolve(flag("--portal") ?? join(root, "apps/portal/dist/client")),
    out: resolve(flag("--out") ?? join(root, "apps/box/dist/shopper-box")),
  });
}

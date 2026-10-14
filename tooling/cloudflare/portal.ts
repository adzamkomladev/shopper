import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { build } from "vite-plus";
import { unstable_readConfig } from "wrangler";

const portal = fileURLToPath(new URL("../../apps/portal/", import.meta.url));
const output = join(portal, ".cloudflare/output/v0");
const worker = join(output, "workers/default");
process.env.CLOUDFLARE_ENV = "staging";
await rm(join(portal, ".cloudflare/output"), { recursive: true, force: true });
await build({ root: portal, configFile: join(portal, "vite.config.ts") });
const config = unstable_readConfig({ config: join(portal, "dist/server/wrangler.json") });
if (!config.account_id) throw new Error("Portal Cloudflare account_id is required");
await mkdir(worker, { recursive: true });
await cp(join(portal, "dist/server"), join(worker, "bundle"), { recursive: true });
await cp(join(portal, "dist/client"), join(worker, "assets"), { recursive: true });
const modules: Record<string, { type: string }> = {};
async function collect(directory: string, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) await collect(join(directory, entry.name), `${path}/`);
    else if (entry.name.endsWith(".js")) modules[path] = { type: "esm" };
  }
}
await collect(join(worker, "bundle"));
const staging = config;
await writeFile(
  join(output, "config.json"),
  JSON.stringify({ accountId: config.account_id, buildContext: { isPreview: false } }),
);
await writeFile(
  join(worker, "worker.config.json"),
  JSON.stringify({
    name: staging.name,
    compatibilityDate: staging.compatibility_date,
    compatibilityFlags: staging.compatibility_flags,
    domains: ["shopper-staging.temtem.dev"],
    workersDev: true,
    assets: { runWorkerFirst: true },
    observability: staging.observability,
    env: { ASSETS: { type: "assets" } },
    manifest: { type: "complete", mainModule: "index.js", modules },
  }),
);

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { build } from "vite-plus";
import { unstable_readConfig } from "wrangler";
import config from "../../apps/portal/cloudflare.config.json" with { type: "json" };

const portal = fileURLToPath(new URL("../../apps/portal/", import.meta.url));
const output = join(portal, ".cloudflare/output/v0");
const worker = join(output, "workers/default");
const edgePath = fileURLToPath(new URL("../../apps/edge/wrangler.jsonc", import.meta.url));
const edge = unstable_readConfig({ config: edgePath, env: "staging" });
if (!edge.account_id) throw new Error("Edge Cloudflare account_id is required");

await rm(join(portal, ".cloudflare/output"), { recursive: true, force: true });
await build({ root: portal, configFile: join(portal, "vite.config.ts") });
await build({
  root: portal,
  configFile: false,
  build: {
    outDir: join(worker, "bundle"),
    lib: { entry: join(portal, "src/worker.ts"), formats: ["es"], fileName: () => "worker.js" },
    rollupOptions: { external: [] },
    target: "es2022",
  },
});
await cp(join(portal, "dist"), join(worker, "assets"), { recursive: true });
await mkdir(output, { recursive: true });
await writeFile(
  join(output, "config.json"),
  JSON.stringify({
    accountId: edge.account_id,
    buildContext: { isPreview: false },
  }),
);
await writeFile(
  join(worker, "worker.config.json"),
  JSON.stringify({
    ...config,
    manifest: {
      type: "complete",
      mainModule: "worker.js",
      modules: { "worker.js": { type: "esm" } },
    },
  }),
);

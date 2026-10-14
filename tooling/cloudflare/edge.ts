import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createBuilder } from "vite-plus";
import { unstable_readConfig } from "wrangler";

const edge = fileURLToPath(new URL("../../apps/edge/", import.meta.url));
process.env.CLOUDFLARE_ENV = "staging";
const builder = await createBuilder({ root: edge, configFile: join(edge, "vite.config.ts") });
await builder.buildApp();
delete process.env.CLOUDFLARE_ENV;
const source = join(edge, "dist-staging/shopper_edge_dev");
const config = unstable_readConfig({ config: join(source, "wrangler.json") });
if (!config.account_id || !config.name || !config.compatibility_date)
  throw new Error("Staging Worker identity and compatibility date are required");
if (config.name !== "shopper-edge-staging") throw new Error("Refusing a non-staging Worker build");
const chunks = await readdir(join(source, "assets"));
if (chunks.some((name) => !name.endsWith(".js")))
  throw new Error("Cloudflare staging output contains unsupported bundle module types");
const output = join(edge, ".cloudflare/output/v0");
const worker = join(output, "workers/default");
const env: Record<string, object> = {};
const exports: Record<string, object> = {};
for (const binding of config.r2_buckets)
  env[binding.binding] = { type: "r2", name: binding.bucket_name };
for (const binding of config.d1_databases)
  env[binding.binding] = { type: "d1", id: binding.database_id, name: binding.database_name };
for (const binding of config.hyperdrive)
  env[binding.binding] = { type: "hyperdrive", id: binding.id };
for (const binding of config.queues.producers)
  env[binding.binding] = { type: "queue", name: binding.queue };
for (const binding of config.durable_objects.bindings) {
  env[binding.name] = {
    type: "durable-object",
    worker: binding.script_name ?? config.name,
    exportName: binding.class_name,
  };
  if (!binding.script_name)
    exports[binding.class_name] = { type: "durable-object", storage: "sqlite" };
}
for (const binding of config.workflows) {
  env[binding.binding] = {
    type: "workflow",
    name: binding.name,
    worker: binding.script_name ?? config.name,
    exportName: binding.class_name,
  };
  if (!binding.script_name) exports[binding.class_name] = { type: "workflow", name: binding.name };
}
for (const [name, value] of Object.entries(config.vars)) env[name] = { type: "json", value };

await rm(join(edge, ".cloudflare/output"), { recursive: true, force: true });
await mkdir(join(worker, "bundle"), { recursive: true });
await cp(join(source, "index.js"), join(worker, "bundle/index.js"));
await cp(join(source, "assets"), join(worker, "bundle/assets"), { recursive: true });
await writeFile(
  join(output, "config.json"),
  JSON.stringify({
    accountId: config.account_id,
    buildContext: { isPreview: false },
  }),
);
await writeFile(
  join(worker, "worker.config.json"),
  JSON.stringify({
    name: config.name,
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    workersDev: config.workers_dev,
    domains: config.routes?.flatMap(
      (route: string | { pattern: string; custom_domain?: boolean }) =>
        typeof route !== "string" && "custom_domain" in route && route.custom_domain
          ? [route.pattern]
          : [],
    ),
    observability: config.observability,
    env,
    exports,
    manifest: {
      type: "complete",
      mainModule: "index.js",
      modules: Object.fromEntries(
        ["index.js", ...chunks.map((name) => `assets/${name}`)].map((name) => [
          name,
          { type: "esm" },
        ]),
      ),
    },
  }),
);

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { unstable_readConfig } from "wrangler";

type ResolvedConfig = ReturnType<typeof unstable_readConfig>;

/** Maps resolved Wrangler bindings onto Cloudflare Build Output env entries. */
export function buildOutputBindings(config: ResolvedConfig) {
  const env: Record<string, object> = {};
  const exports: Record<string, object> = {};
  for (const binding of config.r2_buckets ?? [])
    env[binding.binding] = { type: "r2", name: binding.bucket_name };
  for (const binding of config.d1_databases ?? [])
    env[binding.binding] = { type: "d1", id: binding.database_id, name: binding.database_name };
  for (const binding of config.hyperdrive ?? [])
    env[binding.binding] = { type: "hyperdrive", id: binding.id };
  for (const binding of config.queues?.producers ?? [])
    env[binding.binding] = { type: "queue", name: binding.queue };
  for (const binding of config.durable_objects?.bindings ?? []) {
    env[binding.name] = {
      type: "durable-object",
      worker: binding.script_name ?? config.name,
      exportName: binding.class_name,
    };
    if (!binding.script_name)
      exports[binding.class_name] = { type: "durable-object", storage: "sqlite" };
  }
  for (const binding of config.workflows ?? []) {
    env[binding.binding] = {
      type: "workflow",
      name: binding.name,
      worker: binding.script_name ?? config.name,
      exportName: binding.class_name,
    };
    if (!binding.script_name)
      exports[binding.class_name] = { type: "workflow", name: binding.name };
  }
  for (const [name, value] of Object.entries(config.vars ?? {}))
    env[name] = { type: "json", value };
  return { env, exports };
}

/** Custom domains declared by the resolved Wrangler routes. */
export function customDomains(config: ResolvedConfig) {
  return config.routes?.flatMap((route: string | { pattern: string; custom_domain?: boolean }) =>
    typeof route !== "string" && "custom_domain" in route && route.custom_domain
      ? [route.pattern]
      : [],
  );
}

/** Every module in the bundle, keyed by its path inside the Worker. */
export async function collectModules(
  directory: string,
  prefix = "",
): Promise<Record<string, { type: string }>> {
  const modules: Record<string, { type: string }> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory())
      Object.assign(modules, await collectModules(join(directory, entry.name), `${path}/`));
    else if (entry.name.endsWith(".js")) modules[path] = { type: "esm" };
  }
  return modules;
}

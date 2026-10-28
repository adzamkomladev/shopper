import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { smoke, type SmokeTarget } from "./smoke";

/**
 * Workers Builds deploy command for one staging Worker. Run from the app folder by
 * `pnpm --filter <app> run deploy:staging`, after that app's `build:staging`.
 */
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

interface Binding {
  type: string;
  id?: string;
}
interface BuiltConfig {
  name: string;
  mode: string;
  domains?: string[];
  env: Record<string, Binding>;
}

const [target, ...flags] = process.argv.slice(2);
if (target !== "edge" && target !== "portal" && target !== "admin")
  throw new Error("Usage: tsx tooling/cloudflare/deploy.ts <edge|portal|admin> [--dry-run]");
const dryRun = flags.includes("--dry-run");
const app = process.cwd();

const config = readBuiltConfig();
if (!config.name.endsWith("-staging") || config.mode !== "staging")
  throw new Error(`Refusing to deploy "${config.name}": the built config is not a staging Worker`);
if (target === "edge" && !dryRun) migrate();
deployWorker();
if (!dryRun) await verify();

/** `cf build` writes the resolved Worker and its build mode under `.cloudflare/output/v0`. */
function readBuiltConfig(): BuiltConfig {
  const output = resolve(app, ".cloudflare/output/v0");
  const read = (path: string) => JSON.parse(readFileSync(resolve(output, path), "utf8"));
  const worker = read("workers/default/worker.config.json") as Omit<BuiltConfig, "mode">;
  return { ...worker, mode: read("config.json").buildContext.mode };
}

function migrate() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL (the direct, non-pooled staging URL) is required to migrate");
  run("pnpm", ["--dir", repoRoot, "run", "db:migrate"]);
  const database = Object.values(config.env).find((binding) => binding.type === "d1")?.id;
  if (!database) throw new Error(`No D1 binding in the ${config.name} config to migrate`);
  const directory = ["--dir", resolve(repoRoot, "packages/db/sqlite/migrations")];
  run("cf", ["d1", "migrations", "apply", database, ...directory]);
  // `list` prints the unapplied migrations as JSON: an empty array means the database is current.
  const pending = JSON.parse(
    run("cf", ["d1", "migrations", "list", database, ...directory], "pipe"),
  );
  if (pending.length > 0)
    throw new Error(`D1 migrations are still pending after apply: ${JSON.stringify(pending)}`);
}

/** Secrets the Worker declares are pushed when the build environment carries them. */
function deployWorker() {
  const args = ["deploy", "--prebuilt", "--mode", "staging", "--no-provision"];
  if (dryRun) return void run("cf", [...args, "--dry-run"]);
  const secrets = Object.fromEntries(
    Object.entries(config.env)
      .filter(([name, binding]) => binding.type === "secret" && process.env[name])
      .map(([name]) => [name, process.env[name]]),
  );
  if (Object.keys(secrets).length === 0) return void run("cf", args);
  const directory = mkdtempSync(join(tmpdir(), "shopper-secrets-"));
  try {
    const file = join(directory, "secrets.json");
    writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
    run("cf", [...args, "--secrets-file", file]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function verify() {
  const domain = config.domains?.[0];
  if (!domain) throw new Error(`No custom domain in the ${config.name} config to smoke test`);
  const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    version: string;
  };
  const failures = await smoke(target as SmokeTarget, `https://${domain}`, manifest.version);
  for (const failure of failures) console.error(`smoke failed: ${failure}`);
  if (failures.length > 0) throw new Error(`${config.name} deployed but failed its smoke test`);
  console.log(`${config.name} deployed and healthy at https://${domain}`);
}

function run(command: string, args: string[], stdio: "inherit" | "pipe" = "inherit") {
  const output = execFileSync(command, args, { cwd: app, stdio, encoding: "utf8" });
  return output ?? "";
}

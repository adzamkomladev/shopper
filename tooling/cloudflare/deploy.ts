import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { smoke, type SmokeTarget } from "./smoke";

/**
 * Deploys one Worker from the app folder, after that app's `build:<stage>`:
 * `pnpm --filter <app> run deploy:staging` or `deploy:production`.
 *
 * Staging goes straight to traffic. Production is two steps: `deploy:production` uploads a version
 * that serves nothing (the bindings and secrets resolve, nothing changes), and `deploy:production
 * --promote` migrates, deploys the build to all traffic and smoke tests it. `--dry-run` prints the plan.
 */
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const modes = { staging: "staging", production: "prod" } as const;

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
const stage = flags[flags.indexOf("--stage") + 1];
if (!["edge", "portal", "admin"].includes(target ?? "") || !flags.includes("--stage"))
  throw new Error(
    "Usage: tsx tooling/cloudflare/deploy.ts <edge|portal|admin> --stage staging|production [--promote] [--dry-run]",
  );
if (stage !== "staging" && stage !== "production")
  throw new Error("--stage staging|production is required");
const dryRun = flags.includes("--dry-run");
const promote = flags.includes("--promote");
if (promote && stage !== "production") throw new Error("--promote is for production only");
const app = process.cwd();
const mode = modes[stage];

const config = readBuiltConfig();
if (!config.name.endsWith(`-${stage}`) || config.mode !== mode)
  throw new Error(
    `Refusing to deploy "${config.name}" as ${stage}: it was built for ${config.mode}`,
  );
for (const [name, binding] of Object.entries(config.env))
  if ((binding.type === "d1" || binding.type === "hyperdrive") && !binding.id)
    throw new Error(`${name} has no id: provision ${stage} and set it in cloudflare.config.ts`);

const live = stage === "staging" || promote;
if (target === "edge" && live) migrate();
if (live)
  await withSecrets((secrets) =>
    run("cf", ["deploy", ...prebuilt(), "--no-provision", ...secrets]),
  );
else
  await withSecrets((secrets) =>
    run("cf", ["workers", "versions", "create", ...prebuilt(), ...secrets]),
  );
if (live) await verify();
if (!live && !dryRun)
  console.log(
    `${config.name}: version uploaded, serving nothing. Promote with deploy:production --promote.`,
  );

/** `cf build` writes the resolved Worker and its build mode under `.cloudflare/output/v0`. */
function readBuiltConfig(): BuiltConfig {
  const output = resolve(app, ".cloudflare/output/v0");
  const read = (path: string) => JSON.parse(readFileSync(resolve(output, path), "utf8"));
  const worker = read("workers/default/worker.config.json") as Omit<BuiltConfig, "mode">;
  return { ...worker, mode: read("config.json").buildContext.mode };
}

function prebuilt() {
  return ["--prebuilt", "--mode", mode, "--tag", `v${version()}`];
}

function migrate() {
  if (!process.env.DATABASE_URL)
    throw new Error(`DATABASE_URL (the direct, non-pooled ${stage} URL) is required to migrate`);
  run("pnpm", ["--dir", repoRoot, "run", "db:migrate"]);
  const database = Object.values(config.env).find((binding) => binding.type === "d1")?.id;
  if (!database) throw new Error(`No D1 binding in the ${config.name} config to migrate`);
  const directory = ["--dir", resolve(repoRoot, "packages/db/sqlite/migrations")];
  run("cf", ["d1", "migrations", "apply", database, ...directory]);
  if (dryRun) return;
  // `list` prints the unapplied migrations as JSON: an empty array means the database is current.
  const pending = JSON.parse(
    run("cf", ["d1", "migrations", "list", database, ...directory], "pipe"),
  );
  if (pending.length > 0)
    throw new Error(`D1 migrations are still pending after apply: ${JSON.stringify(pending)}`);
}

/** Secrets the Worker declares are pushed when the build environment carries them. */
async function withSecrets(upload: (args: string[]) => void) {
  const secrets = Object.fromEntries(
    Object.entries(config.env)
      .filter(([name, binding]) => binding.type === "secret" && process.env[name])
      .map(([name]) => [name, process.env[name]]),
  );
  if (dryRun || Object.keys(secrets).length === 0) return upload([]);
  const directory = mkdtempSync(join(tmpdir(), "shopper-secrets-"));
  try {
    const file = join(directory, "secrets.json");
    writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
    upload(["--secrets-file", file]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function verify() {
  const domain = config.domains?.[0];
  if (!domain) throw new Error(`No custom domain in the ${config.name} config to smoke test`);
  if (dryRun) return console.log(`smoke ${target} https://${domain}`);
  const failures = await smoke(target as SmokeTarget, `https://${domain}`, version());
  for (const failure of failures) console.error(`smoke failed: ${failure}`);
  if (failures.length > 0) throw new Error(`${config.name} deployed but failed its smoke test`);
  console.log(`${config.name} deployed and healthy at https://${domain}`);
}

function version() {
  return (JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { version: string })
    .version;
}

function run(command: string, args: string[], stdio: "inherit" | "pipe" = "inherit") {
  if (dryRun) {
    console.log([command, ...args].join(" "));
    return "";
  }
  return execFileSync(command, args, { cwd: app, stdio, encoding: "utf8" }) ?? "";
}

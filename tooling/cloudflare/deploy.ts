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
// Pushed only when present in the build environment; otherwise set once with `wrangler secret put`.
// The portal keeps SHOPPER_AUTH_URL as a plain var in wrangler.jsonc; the edge needs it as a secret.
const WORKER_SECRETS = [
  "SHOPPER_AUTH_SECRET",
  "SHOPPER_BOOTSTRAP_TOKEN",
  "SHOPPER_LINK_SECRET",
  "MAILEROO_API_KEY",
  "MAILEROO_FROM",
  "PAYSTACK_SECRET_KEY",
  "SHOPPER_S3_ENDPOINT",
  "SHOPPER_S3_BUCKET",
  "SHOPPER_S3_RECEIPTS_BUCKET",
  "SHOPPER_S3_REGION",
  "SHOPPER_S3_ACCESS_KEY_ID",
  "SHOPPER_S3_SECRET_ACCESS_KEY",
];

interface BuiltConfig {
  name: string;
  mode: string;
  domains?: string[];
}

const [target, ...flags] = process.argv.slice(2);
if (target !== "edge" && target !== "portal")
  throw new Error("Usage: tsx tooling/cloudflare/deploy.ts <edge|portal> [--dry-run]");
const dryRun = flags.includes("--dry-run");
const app = process.cwd();

const config = readBuiltConfig();
if (!config.name.endsWith("-staging") || config.mode !== "staging")
  throw new Error(`Refusing to deploy "${config.name}": the built config is not a staging Worker`);
if (target === "edge") {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL (the direct, non-pooled staging URL) is required to migrate");
  if (!dryRun) {
    run("pnpm", ["--dir", repoRoot, "run", "db:migrate"]);
    run("wrangler", ["d1", "migrations", "apply", "CACHE_DB", "--remote", "--env", "staging"]);
  }
}
deployWorker();
if (!dryRun) await verify();

/** `cf build` writes the resolved Worker and its build mode under `.cloudflare/output/v0`. */
function readBuiltConfig(): BuiltConfig {
  const output = resolve(app, ".cloudflare/output/v0");
  const read = (path: string) => JSON.parse(readFileSync(resolve(output, path), "utf8"));
  const worker = read("workers/default/worker.config.json") as Omit<BuiltConfig, "mode">;
  return { ...worker, mode: read("config.json").buildContext.mode };
}

function deployWorker() {
  const secrets = Object.fromEntries(
    (target === "edge" ? ["SHOPPER_AUTH_URL", ...WORKER_SECRETS] : WORKER_SECRETS)
      .filter((name) => process.env[name])
      .map((name) => [name, process.env[name]]),
  );
  const args = ["deploy", ...(dryRun ? ["--dry-run"] : [])];
  if (dryRun || Object.keys(secrets).length === 0) return run("wrangler", args);
  const directory = mkdtempSync(join(tmpdir(), "shopper-secrets-"));
  try {
    const file = join(directory, "secrets.json");
    writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
    run("wrangler", [...args, "--secrets-file", file]);
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

function run(command: string, args: string[]) {
  execFileSync(command, args, { cwd: app, stdio: "inherit" });
}

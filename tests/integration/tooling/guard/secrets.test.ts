// Day 26 S3: secrets live in `wrangler secret` / the box's environment, never in the repository.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, expect, test } from "vite-plus/test";
import { guard } from "../../../../tooling/guard";

const workspace = mkdtempSync(join(tmpdir(), "shopper-guard-secrets-"));
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

test("guard fails on a committed env file or a secret written into a deploy config", () => {
  write("apps/edge/package.json", JSON.stringify({ name: "@shopper/edge" }));
  write("apps/edge/.dev.vars", "SHOPPER_AUTH_SECRET=leaked\n");
  write("apps/edge/.dev.vars.example", "SHOPPER_AUTH_SECRET=dev-only-placeholder\n");
  write(".env.production", "DATABASE_URL=postgres://prod\n");
  write("apps/box/.env", "SHOPPER_LINK_SECRET=local\n");
  write(
    "apps/edge/cloudflare.config.ts",
    [
      'const secrets = ["SHOPPER_AUTH_SECRET", "PAYSTACK_SECRET_KEY"];',
      "export default { secrets, vars: {",
      '  SHOPPER_AUTH_URL: "https://shop.example",',
      '  PAYSTACK_SECRET_KEY: "sk_live_123",',
      '  "SHOPPER_BOOTSTRAP_TOKEN": `token`,',
      "} };",
    ].join("\n"),
  );
  write(
    "apps/portal/cloudflare.config.ts",
    [
      "export default { env: {",
      '  SHOPPER_AUTH_URL: bindings.text("https://shop.example"),',
      '  SHOPPER_LINK_SECRET: bindings.text("leaked-through-a-binding"),',
      "} };",
      "",
    ].join("\n"),
  );
  execFileSync("git", ["init", "-q"], { cwd: workspace });
  execFileSync("git", ["add", "-A"], { cwd: workspace });
  // An env file on disk that git does not track is a developer's local copy, not a leak.
  write("apps/portal/.dev.vars", "SHOPPER_AUTH_SECRET=local-only\n");

  expect(
    guard(workspace)
      .filter(({ rule }) => rule.startsWith("secret"))
      .map(({ rule, file }) => `${rule} ${file}`)
      .sort(),
  ).toEqual(
    [
      "secret-file .env.production",
      "secret-file apps/box/.env",
      "secret-file apps/edge/.dev.vars",
      "secret-literal apps/edge/cloudflare.config.ts",
      "secret-literal apps/portal/cloudflare.config.ts",
    ].sort(),
  );
});

function write(path: string, content: string) {
  const file = join(workspace, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

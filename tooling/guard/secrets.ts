import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Violation } from "../guard";
import { walk, type Node } from "./architecture";

const ENV_FILE = /(^|\/)(\.dev\.vars|\.env)(\.[^/]+)?$/;
const SECRET_NAME = /(SECRET|TOKEN|PASSWORD|_KEY)$/;
const DEPLOY_CONFIG = /^apps\/[^/]+\/[^/]*\.config\.(ts|mts)$/;

/** Env files git tracks. Untracked ones on disk are a developer's local copy; `.example` files hold placeholders. */
export function trackedSecretFiles(root: string): Violation[] {
  if (!existsSync(join(root, ".git"))) return [];
  return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((file) => ENV_FILE.test(file) && !file.endsWith(".example"))
    .map((file) => ({
      rule: "secret-file",
      file,
      message: "Env files hold secrets. Untrack it and set the values with `wrangler secret put`.",
    }));
}

/** A secret-named key given a value in a deploy config. Names belong in the config's `secrets` list. */
export function literalSecrets(file: string, program: unknown): Violation[] {
  if (!DEPLOY_CONFIG.test(file)) return [];
  let found = false;
  walk(program, (node) => {
    if (node.type !== "Property" || !node.key) return;
    const name = node.key.name ?? node.key.value;
    const value = node.value as Node | undefined;
    if (typeof name === "string" && SECRET_NAME.test(name) && isText(value)) found = true;
  });
  if (!found) return [];
  const message = "A secret's value is written into a deploy config. List its name in `secrets`.";
  return [{ rule: "secret-literal", file, message }];
}

// A value written in place: a string, a template, or one passed to a config helper like `bindings.text("…")`.
const isText = (node?: Node): boolean =>
  (node?.type === "Literal" && typeof node.value === "string") ||
  node?.type === "TemplateLiteral" ||
  (node?.type === "CallExpression" && (node.arguments ?? []).some((argument) => isText(argument)));

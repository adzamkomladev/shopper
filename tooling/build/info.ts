import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as {
  version: string;
};
let gitSha = "uncommitted";
try {
  gitSha = execFileSync("git", ["rev-parse", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  /* Initial workspace has no commit yet. */
}
export const buildDefines = {
  SHOPPER_VERSION: JSON.stringify(manifest.version),
  GIT_SHA: JSON.stringify(process.env.GITHUB_SHA ?? gitSha),
  BUILD_DATE: JSON.stringify(process.env.BUILD_DATE ?? new Date().toISOString()),
  SCHEMA_VERSION: String(
    (
      JSON.parse(
        readFileSync(
          new URL("../../packages/db/pg/migrations/meta/_journal.json", import.meta.url),
          "utf8",
        ),
      ) as { entries: Array<{ idx: number }> }
    ).entries.at(-1)?.idx ?? 1,
  ),
  SYNC_PROTOCOL: "3",
  ARCHIVE_FORMAT: "1",
};

export function buildTask(command: string) {
  return {
    command,
    cache: {
      env: ["GITHUB_SHA", "BUILD_DATE"],
      input: [
        { auto: true },
        { pattern: ".git/HEAD", base: "workspace" as const },
        { pattern: ".git/refs/**", base: "workspace" as const },
        { pattern: ".git/packed-refs", base: "workspace" as const },
      ],
    },
  };
}

/**
 * Vite keeps a NODE_ENV the shell already exports (`vp test` sets `test`), so a build run from a
 * test or a dev shell would ship development React. Every release build is production; `--mode`
 * still selects the environment's config.
 */
export function productionBuild() {
  return {
    name: "shopper:production-build",
    config(_config: unknown, { command }: { command: "build" | "serve" }) {
      if (command === "build") process.env.NODE_ENV = "production";
    },
  };
}

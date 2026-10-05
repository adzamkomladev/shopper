import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { buildDefines } from "../build-info";
export default defineConfig({
  root: import.meta.dirname,
  define: buildDefines,
  plugins: [cloudflareTest({ wrangler: { configPath: "../../apps/edge/wrangler.jsonc" } })],
  test: { include: ["worker.test.ts"] },
});

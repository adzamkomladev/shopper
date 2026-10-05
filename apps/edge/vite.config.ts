import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { buildDefines, buildTask } from "../../tooling/build-info";
export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [cloudflare()],
  define: buildDefines,
  build: { outDir: process.env.CLOUDFLARE_ENV === "staging" ? "dist-staging" : "dist" },
});

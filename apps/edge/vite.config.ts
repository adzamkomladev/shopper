import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { buildDefines, buildTask } from "../../tooling/build/info";
export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [cloudflare()],
  define: buildDefines,
  server: { port: 8787 },
});

import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { buildDefines, buildTask, productionBuild } from "../../tooling/build/info";
export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  // Each dev Worker owns an inspector port (portal 9230, shop 9231); `vp run dev` starts them together.
  plugins: [productionBuild(), cloudflare({ inspectorPort: 9229 })],
  define: buildDefines,
  server: { port: 8787 },
});

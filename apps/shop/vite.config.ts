import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { buildDefines, buildTask, productionBuild } from "../../tooling/build/info";
export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [
    productionBuild(),
    // Each dev Worker owns an inspector port (edge 9229, portal 9230); `vp run dev` starts them together.
    cloudflare({ viteEnvironment: { name: "ssr" }, inspectorPort: 9231 }),
    tanstackStart(),
    react(),
  ],
  define: buildDefines,
  server: { port: 5175 },
});

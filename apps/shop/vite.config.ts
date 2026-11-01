import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { buildDefines, buildTask, productionBuild } from "../../tooling/build/info";

// The e2e host (tests/support/shop/server.ts) runs the built server entry under Bun, without workerd.
const testHost = Boolean(process.env.SHOPPER_SHOP_TEST_HOST);

export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [
    productionBuild(),
    // Each dev Worker owns an inspector port (edge 9229, portal 9230); `vp run dev` starts them together.
    ...(testHost ? [] : [cloudflare({ viteEnvironment: { name: "ssr" }, inspectorPort: 9231 })]),
    tanstackStart({ server: { entry: "server.ts" } }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  define: buildDefines,
  build: { outDir: process.env.SHOPPER_BUILD_OUT_DIR },
  ssr: { noExternal: testHost ? true : undefined },
  server: { port: 5175 },
});

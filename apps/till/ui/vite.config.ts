import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { themeScript } from "@shopper/ui/hooks/theme";
import { buildDefines, buildTask, productionBuild } from "../../../tooling/build/info";

export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [
    productionBuild(),
    tailwindcss(),
    react(),
    // As in the portal: a keystroke re-renders only what reads the changed value (the tender amount).
    babel({ presets: [reactCompilerPreset()] }),
    // Both pages set the saved theme before first paint.
    {
      name: "shopper:theme",
      transformIndexHtml: () => [
        { tag: "script", children: themeScript, injectTo: "head-prepend" },
      ],
    },
  ],
  define: buildDefines,
  // Two pages: the register (index.html) and the full back office the host serves under /backoffice/.
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        backoffice: fileURLToPath(new URL("backoffice/index.html", import.meta.url)),
        // SHOPPER_TILL_HARNESS_BUILD adds the sale harness, so the latency spec measures production React.
        ...(process.env.SHOPPER_TILL_HARNESS_BUILD && {
          harness: fileURLToPath(new URL("harness/index.html", import.meta.url)),
        }),
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/bridge": {
        target: process.env.SHOPPER_TILL_HOST_URL ?? "http://127.0.0.1:5186",
        ws: true,
        changeOrigin: false,
      },
    },
  },
});

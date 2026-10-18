import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { buildDefines, buildTask, productionBuild } from "../../../tooling/build/info";

export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [productionBuild(), tailwindcss(), react()],
  define: buildDefines,
  // Two pages: the register (index.html) and the full back office the host serves under /backoffice/.
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        backoffice: fileURLToPath(new URL("backoffice/index.html", import.meta.url)),
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

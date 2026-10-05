import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { buildDefines } from "../../tooling/build-info";
export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tanstackStart(), react()],
  define: buildDefines,
  server: { port: 5175 },
});

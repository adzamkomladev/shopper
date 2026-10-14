import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { buildDefines, buildTask } from "../../tooling/build/info";

export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [
    ...(process.env.SHOPPER_PORTAL_TEST_HOST
      ? []
      : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
    tanstackStart({ server: { entry: "server.ts" } }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  define: buildDefines,
  server: { port: 5173 },
});

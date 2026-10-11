import { defineConfig } from "vite-plus";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { buildDefines, buildTask } from "../../tooling/build-info";

// The API mounts Better Auth under /api/auth and everything else at the root, so only /api/auth
// keeps its prefix. The proxy leaves Origin alone: Better Auth checks it against SHOPPER_AUTH_URL.
const API_URL = process.env.SHOPPER_API_URL ?? "http://localhost:8787";

export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [tailwindcss(), react(), babel({ presets: [reactCompilerPreset()] })],
  define: buildDefines,
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: API_URL,
        rewrite: (path) => (path.startsWith("/api/auth") ? path : path.replace(/^\/api/, "")),
      },
    },
  },
});

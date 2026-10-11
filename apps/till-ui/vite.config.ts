import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { buildDefines, buildTask } from "../../tooling/build-info";
export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [tailwindcss(), react()],
  define: buildDefines,
  server: { port: 5174 },
});

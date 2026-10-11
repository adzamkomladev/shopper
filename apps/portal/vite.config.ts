import { defineConfig } from "vite-plus";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { buildDefines, buildTask } from "../../tooling/build-info";
export default defineConfig({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [tailwindcss(), react(), babel({ presets: [reactCompilerPreset()] })],
  define: buildDefines,
  server: { port: 5173 },
});

import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import { buildDefines } from "../../tooling/build-info";
export default defineConfig({ plugins: [react()], define: buildDefines, server: { port: 5174 } });

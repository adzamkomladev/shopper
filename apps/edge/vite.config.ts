import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { buildDefines } from "../../tooling/build-info";
export default defineConfig({
  plugins: [cloudflare()],
  define: buildDefines,
  build: { outDir: process.env.CLOUDFLARE_ENV === "staging" ? "dist-staging" : "dist" },
});

import { build } from "vite-plus";
import { buildDefines } from "./build-info.ts";
await build({
  configFile: false,
  define: buildDefines,
  build: { ssr: "src/index.ts", outDir: "dist", rollupOptions: { external: ["elysia"] } },
});

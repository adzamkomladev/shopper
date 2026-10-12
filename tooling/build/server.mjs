import { build } from "vite-plus";
import { buildDefines } from "./info.ts";
await build({
  configFile: false,
  define: buildDefines,
  build: { ssr: "src/index.ts", outDir: "dist" },
});

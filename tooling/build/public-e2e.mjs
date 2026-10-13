import { build } from "vite-plus";
import { buildDefines } from "./info.ts";

await build({
  configFile: false,
  define: buildDefines,
  build: {
    ssr: "tests/support/workflows/public-server.ts",
    outDir: ".shopper/public-e2e",
  },
});

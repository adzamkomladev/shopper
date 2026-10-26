import { build } from "vite-plus";
import { buildDefines } from "../info.ts";
import { e2eRun } from "../../e2e/run.ts";

await build({
  configFile: false,
  define: buildDefines,
  build: {
    ssr: "tests/support/workflows/public/server.ts",
    outDir: e2eRun.publicHost,
  },
});

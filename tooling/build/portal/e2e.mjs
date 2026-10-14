import { build } from "vite-plus";
import { buildDefines } from "../info.ts";

process.env.SHOPPER_PORTAL_TEST_HOST = "1";
await build({ root: "apps/portal" });
await build({
  configFile: false,
  define: buildDefines,
  build: { ssr: "tests/support/portal/server.ts", outDir: ".shopper/portal/e2e" },
});

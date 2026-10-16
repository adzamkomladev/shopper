import { build, createBuilder } from "vite-plus";
import { buildDefines } from "../info.ts";

process.env.SHOPPER_PORTAL_TEST_HOST = "1";
// Start prerenders the SPA shell through `vite preview`, which resolves its config from the
// working directory, and builds the client and server environments together.
const root = process.cwd();
process.chdir("apps/portal");
await (await createBuilder()).buildApp();
process.chdir(root);
await build({
  configFile: false,
  define: buildDefines,
  build: { ssr: "tests/support/portal/server.ts", outDir: ".shopper/portal/e2e" },
});

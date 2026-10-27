import { build, createBuilder } from "vite-plus";
import { buildDefines } from "../info.ts";
import { e2eRun } from "../../e2e/run.ts";

process.env.SHOPPER_PORTAL_TEST_HOST = "1";
// Start prerenders the SPA shell through `vite preview`, which resolves its config from the
// working directory, and builds the client and server environments together.
const root = process.cwd();
process.chdir("apps/portal");
// A named run builds into apps/portal/.runs/<id>, so it never empties another run's dist.
process.env.SHOPPER_BUILD_OUT_DIR = e2eRun.outDir;
await (await createBuilder()).buildApp();
process.chdir(root);
await build({
  configFile: false,
  define: buildDefines,
  build: { ssr: "tests/support/portal/server.ts", outDir: e2eRun.portalHost },
});

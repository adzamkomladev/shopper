import { build, createBuilder } from "vite-plus";
import { buildDefines } from "../info.ts";
import { e2eRun } from "../../e2e/run.ts";

// The shop's SSR server entry, built without workerd and run by Bun beside the API (tests/support/shop/server.ts).
process.env.SHOPPER_SHOP_TEST_HOST = "1";
const root = process.cwd();
process.chdir("apps/shop");
// A named run builds into apps/shop/.runs/<id>, so it never empties another run's dist.
process.env.SHOPPER_BUILD_OUT_DIR = e2eRun.outDir;
await (await createBuilder()).buildApp();
process.chdir(root);
await build({
  configFile: false,
  define: buildDefines,
  build: { ssr: "tests/support/shop/server.ts", outDir: e2eRun.shopHost },
});

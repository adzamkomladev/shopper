import { build, createBuilder } from "vite-plus";
import { buildDefines } from "../info.ts";
import { e2eRun } from "../../e2e/run.ts";

// `admin` builds the admin app instead; both run on the same test host (tests/support/portal/server.ts).
const app = process.argv[2] === "admin" ? "admin" : "portal";
process.env.SHOPPER_PORTAL_TEST_HOST = "1";
process.env.SHOPPER_ADMIN_TEST_HOST = "1";
// Start prerenders the SPA shell through `vite preview`, which resolves its config from the
// working directory, and builds the client and server environments together.
const root = process.cwd();
process.chdir(`apps/${app}`);
// A named run builds into apps/<app>/.runs/<id>, so it never empties another run's dist.
process.env.SHOPPER_BUILD_OUT_DIR = e2eRun.outDir;
await (await createBuilder()).buildApp();
process.chdir(root);
await build({
  configFile: false,
  define: buildDefines,
  build: {
    ssr: "tests/support/portal/server.ts",
    outDir: app === "admin" ? e2eRun.adminHost : e2eRun.portalHost,
  },
});

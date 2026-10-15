import { build, createBuilder } from "vite-plus";
import { buildDefines } from "../info.ts";

process.env.SHOPPER_PORTAL_TEST_HOST = "1";
// TanStack Start builds the client and server environments together; plain build() only emits one.
await (await createBuilder({ root: "apps/portal" })).buildApp();
await build({
  configFile: false,
  define: buildDefines,
  build: { ssr: "tests/support/portal/server.ts", outDir: ".shopper/portal/e2e" },
});

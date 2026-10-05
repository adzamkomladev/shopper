import { defineConfig } from "vite-plus";
import { buildTask } from "../../tooling/build-info";
export default defineConfig({
  run: { tasks: { build: buildTask("node ../../tooling/build-server.mjs till-electron") } },
});

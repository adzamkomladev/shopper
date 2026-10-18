import { build } from "vite-plus";
import { runtimeExternals } from "./externals.mjs";
import { buildDefines } from "./info.ts";
await build({
  configFile: false,
  define: buildDefines,
  // Everything is bundled except the native and wasm packages, which load from node_modules (externals.mjs), and Electron itself.
  ssr: { noExternal: true, external: [...runtimeExternals, "electron"] },
  build: {
    ssr:
      { "till-host": "src/server.ts", "till-electron": "src/main.ts" }[process.argv[2]] ??
      "src/index.ts",
    outDir: "dist",
  },
});

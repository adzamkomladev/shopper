import { build } from "vite-plus";
import { buildDefines } from "./info.ts";
await build({
  configFile: false,
  define: buildDefines,
  // satori and resvg-wasm read __dirname and their wasm at runtime, so they load from node_modules, not the bundle.
  ssr: { noExternal: /^@shopper\//, external: ["satori", "@resvg/resvg-wasm"] },
  build: {
    ssr:
      { "till-host": "src/server.ts", "till-electron": "src/main.ts" }[process.argv[2]] ??
      "src/index.ts",
    outDir: "dist",
  },
});

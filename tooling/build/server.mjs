import { build } from "vite-plus";
import { buildDefines } from "./info.ts";
await build({
  configFile: false,
  define: buildDefines,
  // satori and resvg-wasm read __dirname and their wasm at runtime, and SQLite3MC is a native addon, so they load from node_modules, not the bundle.
  ssr: {
    noExternal: /^@shopper\//,
    external: ["satori", "@resvg/resvg-wasm", "better-sqlite3-multiple-ciphers", "serialport"],
  },
  build: {
    ssr:
      { "till-host": "src/server.ts", "till-electron": "src/main.ts" }[process.argv[2]] ??
      "src/index.ts",
    outDir: "dist",
  },
});

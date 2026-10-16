import { build } from "vite-plus";
import { buildDefines } from "./info.ts";
await build({
  configFile: false,
  define: buildDefines,
  ssr: { noExternal: /^@shopper\// },
  build: {
    ssr:
      { "till-host": "src/server.ts", "till-electron": "src/main.ts" }[process.argv[2]] ??
      "src/index.ts",
    outDir: "dist",
  },
});

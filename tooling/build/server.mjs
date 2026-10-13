import { build } from "vite-plus";
import { buildDefines } from "./info.ts";
await build({
  configFile: false,
  define: buildDefines,
  ssr: { noExternal: /^@shopper\// },
  build: {
    ssr: process.argv[2] === "till-host" ? "src/server.ts" : "src/index.ts",
    outDir: "dist",
  },
});

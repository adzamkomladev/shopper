import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { buildDefines, buildTask } from "../../tooling/build/info";

export default defineConfig(({ command, isPreview }) => ({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [
    ...(process.env.SHOPPER_PORTAL_TEST_HOST
      ? []
      : [
          // Prerendering previews the built Worker, which must not open the remote IMPORTS bucket.
          cloudflare({
            viteEnvironment: { name: "ssr" },
            remoteBindings: command === "serve" && !isPreview,
          }),
          prerenderFlag(),
        ]),
    tanstackStart({
      spa: { enabled: true, prerender: { outputPath: "/index" } },
      server: { entry: "server.ts" },
    }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  define: buildDefines,
  server: { port: 5173 },
}));

/**
 * Workerd does not inherit this process's environment, so Start cannot see the flag it sets while
 * it previews the built Worker to prerender the SPA shell. A preview-only `.dev.vars` next to the
 * server bundle carries it; `.assetsignore` and the module manifest keep it out of deployments.
 */
function prerenderFlag(): Plugin {
  return {
    name: "shopper:prerender-flag",
    applyToEnvironment: (environment) => environment.name === "ssr",
    writeBundle(options) {
      if (options.dir) appendFileSync(join(options.dir, ".dev.vars"), "TSS_PRERENDERING=true\n");
    },
  };
}

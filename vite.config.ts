import { defineConfig } from "vite-plus";
import { buildDefines } from "./tooling/build-info";
export default defineConfig({
  define: buildDefines,
  fmt: {
    ignorePatterns: [
      "**/dist/**",
      "**/dist-staging/**",
      "**/routeTree.gen.ts",
      "**/worker-configuration.d.ts",
    ],
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: [
      "**/dist/**",
      "**/dist-staging/**",
      "**/routeTree.gen.ts",
      "**/worker-configuration.d.ts",
      "tooling/worker-tests/**",
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
  run: {
    tasks: {
      build: { command: "vp run -r --cache build", cache: { env: ["GITHUB_SHA", "BUILD_DATE"] } },
      check: { command: "vp check", cache: true },
      test: { command: "vp test", cache: false },
    },
  },
});

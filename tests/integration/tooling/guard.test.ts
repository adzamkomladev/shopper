import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "vite-plus/test";
import { guard } from "../../../tooling/guard";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const workspace = mkdtempSync(join(tmpdir(), "shopper-guard-"));
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

test("the repository satisfies every guard rule", () => {
  expect(guard(repoRoot)).toEqual([]);
});

test("guard reports each boundary, size and React rule it enforces", () => {
  write("apps/portal/package.json", pkg("@shopper/portal", ["@shopper/till-ui"]));
  write("apps/till-ui/package.json", pkg("@shopper/till-ui", ["@shopper/tests"]));
  write("tests/package.json", pkg("@shopper/tests", []));
  write("packages/money/package.json", pkg("@shopper/money", ["@shopper/core"]));
  write("packages/adapters-cf/package.json", pkg("@shopper/adapters-cf", []));
  write(
    "packages/core/package.json",
    JSON.stringify({
      name: "@shopper/core",
      dependencies: { "@shopper/portal": "workspace:*" },
      optionalDependencies: { "@shopper/money": "workspace:*" },
    }),
  );
  write("apps/portal/src/screen.tsx", 'import { useEffect } from "react";\nuseEffect(() => {});\n');
  write("apps/portal/src/hidden.tsx", 'import * as React from "react";\nReact.useLayoutEffect;\n');
  write(
    "apps/portal/src/notes.tsx",
    '// Never useEffect or import "zod" here.\nexport const s = "zod";\n',
  );
  write("apps/portal/src/long.tsx", "export {};\n".repeat(301));
  write("apps/portal/src/emails/receipt.tsx", "export {};\n".repeat(400));
  write("packages/core/src/long.ts", "export {};\n".repeat(251));
  write("packages/core/src/routeTree.gen.ts", "export {};\n".repeat(400));
  write("packages/core/src/platform.ts", 'import { DurableObject } from "cloudflare:workers";\n');
  write("packages/core/src/rivet.ts", 'export { actor } from "rivetkit";\n');
  write("packages/core/src/schema.ts", 'import * as z from /* validation */ "zod";\n');
  write("packages/core/src/lazy.ts", "const z = await import(`zod`);\n");
  write("packages/core/src/legacy.ts", 'import z = require("zod");\n');
  write("packages/core/src/sneaky.ts", 'import { x } from "../../money/src/index";\n');
  write("packages/core/src/phantom.ts", 'const t = await import("@shopper/tax/rules");\n');
  write("packages/core/src/optional.ts", 'import { add } from "@shopper/money";\n');
  write("packages/core/src/devtool.ts", 'import { seed } from "../../../tooling/seed";\n');
  write(
    "packages/adapters/cf/src/index.ts",
    'import { DurableObject } from "cloudflare:workers";\n',
  );

  const found = guard(workspace).map(({ rule, file }) => `${rule} ${file}`);

  expect(found.sort()).toEqual(
    [
      "app-imports-app apps/portal/package.json",
      "imports-tests apps/till-ui/package.json",
      "package-imports-app packages/core/package.json",
      "package-cycle packages/core/package.json",
      "no-effect apps/portal/src/screen.tsx",
      "no-effect apps/portal/src/hidden.tsx",
      "file-too-long apps/portal/src/long.tsx",
      "file-too-long packages/core/src/long.ts",
      "platform-import packages/core/src/platform.ts",
      "platform-import packages/core/src/rivet.ts",
      "no-zod packages/core/src/schema.ts",
      "no-zod packages/core/src/lazy.ts",
      "no-zod packages/core/src/legacy.ts",
      "escapes-package packages/core/src/sneaky.ts",
      "escapes-package packages/core/src/devtool.ts",
      "undeclared-dependency packages/core/src/phantom.ts",
    ].sort(),
  );
});

function write(path: string, content: string) {
  const file = join(workspace, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function pkg(name: string, deps: string[]) {
  const dependencies = Object.fromEntries(deps.map((dep) => [dep, "workspace:*"]));
  return JSON.stringify({ name, dependencies });
}

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, expect, test } from "vite-plus/test";
import { guard } from "../../../tooling/guard";

const root = mkdtempSync(join(tmpdir(), "shopper-architecture-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("the guard rejects misplaced schemas, reusable types, digests and upload proxies", () => {
  write("packages/core/package.json", '{"name":"@shopper/core"}');
  write(
    "packages/core/src/logic.ts",
    `import * as v from "valibot";
export const schema = v.object({ name: v.string() });
export type Shared = { id: string };
crypto.subtle.digest("SHA-256", new Uint8Array());`,
  );
  write("packages/api/src/upload.ts", "request.formData();");
  write("packages/core/src/bad-name.ts", "export const value = 1;");
  write(
    "packages/core/src/workflows/price.ts",
    'export function run() {}\nexport { other } from "./auth";',
  );
  write("packages/backoffice/src/screens/auth/form.tsx", "export function Form() { return null; }");
  write("packages/api/src/routes/orders.ts", 'app.post("/orders/new-order", handler);');
  const rules = guard(root).map(({ rule }) => rule);
  expect(rules).toEqual(
    expect.arrayContaining([
      "backoffice-layout",
      "schema-location",
      "type-location",
      "digest-location",
      "upload-proxy",
      "path-naming",
      "route-naming",
      "workflow-responsibility",
    ]),
  );
});

test("owning modules and stable framework names remain valid", () => {
  const valid = mkdtempSync(join(tmpdir(), "shopper-architecture-valid-"));
  try {
    const files = {
      "packages/core/src/schemas/fields.ts":
        'import * as v from "valibot";\nexport const name = v.string();\nexport type Name = v.InferOutput<typeof name>;',
      "packages/core/src/types.ts": "export type Shared = { id: string };",
      "packages/utils/src/crypto.ts": 'crypto.subtle.digest("SHA-256", new Uint8Array());',
      "packages/core/src/logic.ts": 'import * as v from "valibot";\nv.parse(schema, input);',
      "packages/core/src/workflows/index.ts": 'export { run } from "./price";',
      "apps/shop/src/routes/__root.tsx": "export const Route = {};",
      "packages/api/src/routes/tax/rules.ts": 'app.get("/tax-rules", handler);',
      "packages/backoffice/src/routes/auth/public.tsx":
        'createRoute({ path: "verify-registration" });',
      "packages/adapters/cf/worker-configuration.d.ts": "export type Env = {};",
    };
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(dirname(join(valid, file)), { recursive: true });
      writeFileSync(join(valid, file), content);
    }
    expect(guard(valid)).toEqual([]);
  } finally {
    rmSync(valid, { recursive: true, force: true });
  }
});

function write(file: string, content: string) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}

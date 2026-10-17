import { globSync, readFileSync } from "node:fs";
import { join, posix, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "vite-plus";
import { architectureRules } from "./guard/architecture";

export type Violation = { rule: string; file: string; message: string };
type Kind = "app" | "package" | "tooling" | "tests";
type Project = { dir: string; kind: Kind; name: string; deps: string[] };
type Found = { specs: Set<string>; effect: boolean };
type SyntaxNode = {
  type?: string;
  name?: string;
  value?: unknown;
  source?: SyntaxNode;
  expression?: SyntaxNode;
  callee?: SyntaxNode;
  arguments?: SyntaxNode[];
  expressions?: SyntaxNode[];
  quasis?: { value: { cooked: string } }[];
};

// Files that were over the limit before the guard existed. They may shrink, never grow.
// Split the file, then delete its entry. Never add one.
const BASELINE: Record<string, number> = {
  "tests/integration/auth/auth.test.ts": 526,
  "tests/integration/auth/devices/enrollment.test.ts": 353,
};

const SOURCES = "{apps,packages,tests,tooling}/**/*.{ts,tsx,mts,mjs,js,jsx,vue,astro}";
const IGNORED = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.wrangler/**",
  "**/.vite/**",
  "**/migrations/**",
  "**/*.d.ts",
  "**/*.gen.ts",
];
const KINDS: Record<string, Kind> = {
  apps: "app",
  packages: "package",
  tooling: "tooling",
  tests: "tests",
};
const TEMPLATE = /\.(tsx|jsx|vue|astro)$/;
const SCRIPT = /\.(ts|tsx|mts|mjs|js|jsx)$/;
const EMAIL_TEMPLATE = /(^|\/)emails?\//;
const EFFECTS = new Set(["useEffect", "useLayoutEffect", "useInsertionEffect"]);
const IMPORTS = new Set([
  "ImportDeclaration",
  "ExportAllDeclaration",
  "ExportNamedDeclaration",
  "ImportExpression",
  "TSImportType",
]);
const PLATFORM = /^(cloudflare:|@cloudflare\/|rivetkit|@rivetkit\/)/;
const BUILD_CONFIG = /(^|\/)[^/]+\.config\.(ts|mts|js|mjs)$/;
const PLATFORM_HOMES = /^(packages\/adapters\/[^/]+\/|apps\/(edge|box)\/|tests\/|tooling\/)/;

/** Checks the repository rules in docs/engineering/architecture.md and code-quality.md. */
export function guard(root: string): Violation[] {
  const projects = readProjects(root);
  const violations = [...checkDependencies(projects), ...findCycles(projects)];
  for (const path of globSync(SOURCES, { cwd: root, exclude: IGNORED })) {
    violations.push(...checkFile(root, path.split(sep).join("/"), projects));
  }
  return violations;
}

function readProjects(root: string): Project[] {
  const manifests = globSync("{{apps,packages,tooling}/**,tests}/package.json", {
    cwd: root,
    exclude: IGNORED,
  });
  return manifests.map((path) => {
    const json = JSON.parse(readFileSync(join(root, path), "utf8"));
    const dir = posix.dirname(path.split(sep).join("/"));
    const deps = {
      ...json.dependencies,
      ...json.devDependencies,
      ...json.peerDependencies,
      ...json.optionalDependencies,
    };
    return { dir, kind: KINDS[dir.split("/")[0]], name: json.name, deps: Object.keys(deps) };
  });
}

/** Apps import packages only; packages never import apps; nothing shipped imports tooling or tests. */
function checkDependencies(projects: Project[]): Violation[] {
  const byName = new Map(projects.map((project) => [project.name, project]));
  const violations: Violation[] = [];
  for (const project of projects) {
    if (project.kind === "tests" || project.kind === "tooling") continue;
    const file = `${project.dir}/package.json`;
    for (const dep of project.deps) {
      const target = byName.get(dep);
      if (target?.kind === "app") {
        const rule = project.kind === "app" ? "app-imports-app" : "package-imports-app";
        violations.push({
          rule,
          file,
          message: `${project.name} depends on app ${dep}. Move the shared code into a package.`,
        });
      }
      if (target?.kind === "tooling" || target?.kind === "tests") {
        violations.push({
          rule: `imports-${target.kind}`,
          file,
          message: `${project.name} depends on ${dep}, which is never shipped.`,
        });
      }
    }
  }
  return violations;
}

function findCycles(projects: Project[]): Violation[] {
  const byName = new Map(projects.map((project) => [project.name, project]));
  const violations: Violation[] = [];
  const done = new Set<string>();
  const visit = (name: string, path: string[]) => {
    const start = path.indexOf(name);
    if (start >= 0) {
      const cycle = [...path.slice(start), name];
      const first = byName.get([...cycle].sort()[0])!;
      const message = `Workspace dependency cycle: ${cycle.join(" → ")}`;
      violations.push({ rule: "package-cycle", file: `${first.dir}/package.json`, message });
      return;
    }
    if (done.has(name)) return;
    for (const dep of byName.get(name)!.deps) if (byName.has(dep)) visit(dep, [...path, name]);
    done.add(name);
  };
  for (const name of [...byName.keys()].sort()) visit(name, []);
  return violations;
}

function checkFile(root: string, file: string, projects: Project[]): Violation[] {
  const text = readFileSync(join(root, file), "utf8");
  const owner = projects.find((project) => file.startsWith(`${project.dir}/`));
  const violations: Violation[] = [];
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  const limit = TEMPLATE.test(file) ? 300 : 250;
  if (lines > Math.max(limit, BASELINE[file] ?? 0) && !EMAIL_TEMPLATE.test(file)) {
    const message = `${lines} lines; the limit is ${limit}. Split it into focused modules or components.`;
    violations.push({ rule: "file-too-long", file, message });
  }
  // ponytail: .vue/.astro get the size check only; the stack is React. Parse their script blocks if one is ever added.
  if (!SCRIPT.test(file)) return violations;
  const found: Found = { specs: new Set(), effect: false };
  const program = parseSync(file, text).program;
  violations.push(...architectureRules(file, program));
  const barrel = /^(apps|packages)\/.*\/index\.(ts|tsx)$/.test(file);
  const frameworkRoute = /^apps\/[^/]+\/src\/routes\//.test(file);
  if (
    barrel &&
    !frameworkRoute &&
    program.body.some(
      (node) =>
        node.type !== "ExportAllDeclaration" &&
        (node.type !== "ExportNamedDeclaration" || node.declaration),
    )
  ) {
    violations.push({
      rule: "index-implementation",
      file,
      message: "index only re-exports. Move implementation into its owning module.",
    });
  }
  scan(program, found);
  if (/^(apps|packages)\//.test(file) && found.effect) {
    const message =
      "Effects are banned. See docs/engineering/frontend.md for the replacement pattern.";
    violations.push({ rule: "no-effect", file, message });
  }
  for (const spec of found.specs) {
    const violation = checkImport(file, spec, owner);
    if (violation) violations.push(violation);
  }
  return violations;
}

/** Collects module specifiers and effect-hook references from the syntax tree, never from comments or strings. */
function scan(node: unknown, found: Found): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((child) => scan(child, found));
  const { type = "", name = "", source, expression, callee, arguments: args } = node as SyntaxNode;
  if (type === "Identifier" && EFFECTS.has(name)) found.effect = true;
  const required = type === "CallExpression" && callee?.name === "require" ? args?.[0] : undefined;
  const external = type === "TSExternalModuleReference" ? expression : required; // import x = require("y")
  const spec = literalText(IMPORTS.has(type) ? source : external);
  if (spec) found.specs.add(spec);
  for (const child of Object.values(node)) scan(child, found);
}

function literalText(node?: SyntaxNode): string | undefined {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions?.length === 0) {
    return node.quasis?.[0].value.cooked;
  }
}

function checkImport(file: string, spec: string, owner?: Project): Violation | undefined {
  if (spec === "zod" || spec.startsWith("zod/")) {
    return { rule: "no-zod", file, message: "Valibot only: import * as v from 'valibot'." };
  }
  const buildConfig = BUILD_CONFIG.test(file);
  if (PLATFORM.test(spec) && !PLATFORM_HOMES.test(file) && !buildConfig) {
    const message = `${spec} is platform code. Put it in packages/adapters/* behind a port.`;
    return { rule: "platform-import", file, message };
  }
  if (spec.startsWith(".") && owner) {
    const target = posix.join(posix.dirname(file), spec);
    const usesTooling = (owner.kind === "tests" || buildConfig) && target.startsWith("tooling/");
    if (!target.startsWith(`${owner.dir}/`) && !usesTooling) {
      const message = `${spec} reaches outside ${owner.dir}. Import the package by name instead.`;
      return { rule: "escapes-package", file, message };
    }
  }
  const name = spec.match(/^@shopper\/[^/]+/)?.[0];
  if (name && owner && name !== owner.name && !owner.deps.includes(name)) {
    const message = `${name} is not declared in ${owner.dir}/package.json.`;
    return { rule: "undeclared-dependency", file, message };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = guard(fileURLToPath(new URL("../", import.meta.url)));
  for (const { rule, file, message } of violations) console.error(`${file}  [${rule}]  ${message}`);
  if (violations.length) process.exit(1);
  console.log("guard: all repository rules pass");
}

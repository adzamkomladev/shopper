import type { Violation } from "../guard";

type Node = {
  type?: string;
  name?: string;
  value?: unknown;
  callee?: Node;
  object?: Node;
  property?: Node;
  source?: Node;
  declaration?: Node;
  exportKind?: string;
  arguments?: Node[];
  specifiers?: { local?: Node }[];
  properties?: Node[];
  key?: Node;
};
const VALIDATION = new Set([
  "parse",
  "safeParse",
  "parseAsync",
  "safeParseAsync",
  "is",
  "assert",
  "flatten",
  "isValiError",
  "getDotPath",
  "getGlobalConfig",
  "setGlobalConfig",
  "deleteGlobalConfig",
  "getGlobalMessage",
  "setGlobalMessage",
  "deleteGlobalMessage",
  "getSchemaMessage",
  "setSchemaMessage",
  "deleteSchemaMessage",
  "getSpecificMessage",
  "setSpecificMessage",
  "deleteSpecificMessage",
]);

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "all", "route", "use"]);
const PUBLISHED_ROUTES = new Set([
  "/tax-rules",
  "tax-rules",
  "/verify-registration",
  "verify-registration",
  "/accept-invitation",
  "accept-invitation",
  "/auth/get-session",
  "/auth/sign-out",
  "/kyc/:id/skip-id",
]);

export function architectureRules(file: string, program: unknown): Violation[] {
  const violations: Violation[] = [];
  const shipped = /^(apps|packages)\//.test(file);
  const schema = /\/schemas\//.test(file);
  const types = file.endsWith("/types.ts") || schema;
  const add = (rule: string, message: string) => {
    if (!violations.some((item) => item.rule === rule)) violations.push({ rule, file, message });
  };
  if (file.split("/").some((part) => part.includes("-")))
    add("path-naming", "Authored paths use nested context folders without hyphens.");
  if (file.startsWith("packages/backoffice/src/screens/") && !file.endsWith("/screen.tsx"))
    add(
      "backoffice-layout",
      "Screen folders contain composition entries; move parts, queries and hooks to their responsibility folders.",
    );
  if (!shipped) return violations;
  const aliases = new Set<string>();
  walk(program, (node) => {
    if (node.type === "ImportDeclaration" && node.source?.value === "valibot")
      for (const specifier of node.specifiers ?? [])
        if (specifier.local?.name) aliases.add(specifier.local.name);
  });
  walk(program, (node) => {
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration &&
      !types &&
      ["TSTypeAliasDeclaration", "TSInterfaceDeclaration"].includes(node.declaration.type ?? "")
    )
      add(
        "type-location",
        "Reusable exported types belong in types.ts or their owning schema module.",
      );
    if (node.type !== "CallExpression") return;
    const callee = node.callee;
    const member = callee?.type === "MemberExpression";
    const argument = node.arguments?.[0];
    const route =
      member &&
      HTTP_METHODS.has(callee.property?.name ?? "") &&
      typeof argument?.value === "string" &&
      argument.value.startsWith("/")
        ? argument.value
        : callee?.name === "createRoute"
          ? argument?.properties?.find((property) => property.key?.name === "path")?.value
          : undefined;
    const path = typeof route === "string" ? route : (route as Node | undefined)?.value;
    if (typeof path === "string" && path.includes("-") && !PUBLISHED_ROUTES.has(path))
      add(
        "route-naming",
        "New authored routes use nested context paths; preserve only the documented published URL aliases.",
      );
    if (
      member &&
      aliases.has(callee.object?.name ?? "") &&
      !schema &&
      !VALIDATION.has(callee.property?.name ?? "")
    )
      add(
        "schema-location",
        "Construct Valibot schemas in the producing package's schemas folder.",
      );
    if (
      member &&
      callee.property?.name === "digest" &&
      node.arguments?.[0]?.value === "SHA-256" &&
      file !== "packages/utils/src/crypto.ts"
    )
      add(
        "digest-location",
        "Reuse SHA-256 from @shopper/utils; keep domain canonicalization separate.",
      );
    if (file.startsWith("packages/api/") && member && callee.property?.name === "formData")
      add("upload-proxy", "Issue an asset grant; upload bytes directly to object storage.");
  });
  const body = (program as { body?: Node[] }).body ?? [];
  if (
    /\/workflows\/[^/]+\.ts$/.test(file) &&
    !file.endsWith("/index.ts") &&
    body.some((node) => node.type === "ExportNamedDeclaration" && !!node.declaration) &&
    body.some(
      (node) =>
        ["ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type ?? "") &&
        node.exportKind !== "type" &&
        typeof node.source?.value === "string" &&
        !/(?:^|\/)(?:schemas|types)(?:\/|$)/.test(node.source.value),
    )
  )
    add(
      "workflow-responsibility",
      "A workflow implementation must not re-export another workflow.",
    );
  return violations;
}

function walk(value: unknown, visit: (node: Node) => void): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  visit(value as Node);
  for (const child of Object.values(value)) walk(child, visit);
}

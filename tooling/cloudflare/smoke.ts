import { readFileSync } from "node:fs";

export type SmokeTarget = "edge" | "portal";
export interface SmokeOptions {
  attempts?: number;
  delayMs?: number;
}

/** Checks a deployed Worker over HTTP; resolves to the failures of the last attempt (empty = pass). */
export async function smoke(
  target: SmokeTarget,
  baseUrl: string,
  version: string,
  { attempts = 6, delayMs = 5000 }: SmokeOptions = {},
): Promise<string[]> {
  let failures: string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    failures = await check(target, baseUrl, version);
    if (failures.length === 0 || attempt === attempts) break;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return failures;
}

async function check(target: SmokeTarget, baseUrl: string, version: string) {
  const failures: string[] = [];
  const get = async (path: string, verify: (response: Response, body: string) => string | void) => {
    try {
      const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
      const problem = verify(response, await response.text());
      if (problem) failures.push(`GET ${path}: ${problem}`);
    } catch (error) {
      failures.push(`GET ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  if (target === "edge") {
    await get("/health", (response, body) => {
      if (response.status !== 200) return `status ${response.status}`;
      const reported = response.headers.get("Shopper-Version");
      if (reported !== version)
        return `Shopper-Version ${reported ?? "missing"}, expected ${version}`;
      if (!body.includes('"status":"ok"')) return "body is not an ok health report";
    });
    return failures;
  }
  const shell = (response: Response, body: string) => {
    if (response.status !== 200) return `status ${response.status}`;
    if (!response.headers.get("content-type")?.includes("text/html")) return "not HTML";
    if (!body.includes("$tsr")) return "not the SPA shell";
    // A shell prerendered without the client manifest points at Vite's dev server and renders blank.
    if (body.includes('"/@id/')) return "shell loads dev-server modules";
  };
  await get("/", shell);
  await get("/products", shell);
  await get("/api/health", (response, body) => {
    if (response.status !== 200) return `status ${response.status}`;
    if (!response.headers.get("content-type")?.includes("json")) return "not JSON";
    try {
      JSON.parse(body);
    } catch {
      return "invalid JSON";
    }
  });
  return failures;
}

if (import.meta.main) {
  const [target, baseUrl] = process.argv.slice(2);
  if ((target !== "edge" && target !== "portal") || !baseUrl)
    throw new Error("Usage: tsx tooling/cloudflare/smoke.ts <edge|portal> <base-url>");
  const manifest = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  const failures = await smoke(target, baseUrl, manifest.version, { attempts: 1 });
  for (const failure of failures) console.error(`smoke failed: ${failure}`);
  if (failures.length > 0) process.exit(1);
  console.log(`smoke passed: ${target} ${baseUrl}`);
}

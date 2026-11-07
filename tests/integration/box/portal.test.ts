// The box serves the back office from SHOPPER_PORTAL_DIR on the API's origin: files that exist, the SPA shell for a
// browser navigation, and `/api/*` as the API, the paths the portal calls in the cloud.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, expect, test } from "vite-plus/test";
import { createBoxApp } from "@shopper/box";

let root: string;
let host: ReturnType<typeof createBoxApp>;
const page = { accept: "text/html,application/xhtml+xml" };
const get = (path: string, headers: Record<string, string> = {}) =>
  host.fetch(new Request(`http://box.test${path}`, { headers }));

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "box-portal-"));
  await mkdir(join(root, "client", "assets"), { recursive: true });
  await writeFile(join(root, "client", "index.html"), "<!doctype html><title>Shopper</title>");
  await writeFile(join(root, "client", "assets", "app-1a2b.js"), "export {};");
  await writeFile(join(root, "secret.txt"), "not for browsers");
  host = createBoxApp({ SHOPPER_PORTAL_DIR: join(root, "client") });
});

test("a browser navigation gets the shell, framed by nobody", async () => {
  for (const path of ["/", "/stores/abc", "/settings/team?tab=roles"]) {
    const response = await get(path, page);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
    expect(await response.text()).toContain("<title>Shopper</title>");
  }
});

test("a built asset is served with its content type", async () => {
  const response = await get("/assets/app-1a2b.js");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("javascript");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.text()).toBe("export {};");
});

test("a path outside the portal never leaks a file", async () => {
  for (const path of ["/%2e%2e/secret.txt", "/assets/..%2f..%2fsecret.txt", "/..%5csecret.txt"]) {
    const response = await get(path);
    expect(await response.text()).not.toContain("not for browsers");
  }
});

test("/api/* is the API, and API calls at the root stay the API", async () => {
  const health = await get("/api/health");
  expect(health.status).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok" });
  // Not a browser navigation: a till's JSON call is never answered with the shell.
  const till = await get("/stores/abc", { accept: "application/json" });
  expect(till.headers.get("content-type")).not.toContain("text/html");
});

test("without SHOPPER_PORTAL_DIR the box serves no shell", async () => {
  const bare = createBoxApp({});
  const response = await bare.fetch(new Request("http://box.test/", { headers: page }));
  expect(await response.text()).not.toContain("<title>Shopper</title>");
});

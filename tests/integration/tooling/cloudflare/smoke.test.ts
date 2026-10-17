import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, test } from "vite-plus/test";
import { smoke } from "../../../../tooling/cloudflare/smoke";

const shell = '<!doctype html><script>$tsr=[]</script><div id="root"></div>';
let server: Server | undefined;
afterEach(() => server?.close());

async function serve(routes: Record<string, [number, Record<string, string>, string]>) {
  server = createServer((request, response) => {
    const [status, headers, body] = routes[request.url ?? ""] ?? [404, {}, "not found"];
    response.writeHead(status, headers).end(body);
  });
  await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const options = { attempts: 2, delayMs: 0 };
const html = { "content-type": "text/html" };
const json = { "content-type": "application/json" };
const health = [200, { ...json, "Shopper-Version": "1.2.3" }, '{"status":"ok"}'] as const;

test("edge passes when /health is ok and reports the expected version", async () => {
  const url = await serve({ "/health": [...health] });
  expect(await smoke("edge", url, "1.2.3", options)).toEqual([]);
});

test("edge fails on a wrong version header and on an unhealthy status", async () => {
  const wrong = await serve({ "/health": [...health] });
  expect(await smoke("edge", wrong, "9.9.9", options)).toEqual([
    "GET /health: Shopper-Version 1.2.3, expected 9.9.9",
  ]);
  server?.close();
  const down = await serve({ "/health": [503, {}, "down"] });
  expect(await smoke("edge", down, "1.2.3", options)).toEqual(["GET /health: status 503"]);
});

test("portal passes with the shell on / and /products and JSON on /api/health", async () => {
  const url = await serve({
    "/": [200, html, shell],
    "/products": [200, html, shell],
    "/api/health": [200, json, '{"status":"ok"}'],
  });
  expect(await smoke("portal", url, "1.2.3", options)).toEqual([]);
});

test("portal reports every failing check, and a refused connection counts as one", async () => {
  const url = await serve({
    "/": [200, html, shell],
    "/products": [200, html, "<html>plain page</html>"],
    "/api/health": [200, html, "<html></html>"],
  });
  expect(await smoke("portal", url, "1.2.3", options)).toEqual([
    "GET /products: not the SPA shell",
    "GET /api/health: not JSON",
  ]);
  server?.close();
  const failures = await smoke("portal", "http://127.0.0.1:1", "1.2.3", options);
  expect(failures).toHaveLength(3);
});

test("portal fails a shell prerendered against the dev client entry", async () => {
  const dev = shell.replace("</script>", '</script><script src="/@id/virtual:entry"></script>');
  const url = await serve({
    "/": [200, html, dev],
    "/products": [200, html, dev],
    "/api/health": [200, json, '{"status":"ok"}'],
  });
  expect(await smoke("portal", url, "1.2.3", options)).toEqual([
    "GET /: shell loads dev-server modules",
    "GET /products: shell loads dev-server modules",
  ]);
});

test("a check that recovers on a later attempt passes", async () => {
  let calls = 0;
  server = createServer((_request, response) => {
    response.writeHead(++calls === 1 ? 502 : 200, { ...json, "Shopper-Version": "1.2.3" });
    response.end('{"status":"ok"}');
  });
  await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  expect(await smoke("edge", url, "1.2.3", options)).toEqual([]);
});

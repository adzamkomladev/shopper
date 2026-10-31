// Crash reporting from the Electron main process (apps/till/electron/src/crash.ts) into a local stand-in for Sentry's
// ingest. A host that dies before ready sends one event, tagged with the register's release and channel, with the
// device token, the database key and phone numbers gone from it. With no DSN, nothing is sent.
import { createServer, type IncomingMessage } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { afterEach, expect, test } from "vite-plus/test";
import { buildInfo } from "@shopper/config";
import { register } from "../../support/hardware/register";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const dyingHost = resolve("tests/support/till/crash/host.mjs");

/** Collects every envelope item Sentry's transport posts. */
async function ingest() {
  const items: { type: string; body: Record<string, unknown>; raw: string }[] = [];
  const server = createServer(async (request: IncomingMessage, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    const text = (
      request.headers["content-encoding"] === "gzip" ? gunzipSync(body) : body
    ).toString();
    const [, ...lines] = text.split("\n");
    for (let index = 0; index + 1 < lines.length; index += 2) {
      const header = JSON.parse(lines[index]!) as { type: string };
      const raw = lines[index + 1]!;
      items.push({ type: header.type, body: JSON.parse(raw), raw: text });
    }
    response.writeHead(200).end("{}");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  cleanup.push(() => new Promise((done) => server.close(() => done())));
  const port = (server.address() as AddressInfo).port;
  return { dsn: `http://public@127.0.0.1:${port}/1`, items };
}

test("a host that dies before ready sends one scrubbed event tagged with release and channel", async () => {
  const sentry = await ingest();
  const { start } = await register(cleanup);
  const child = await start([], { SHOPPER_SENTRY_DSN: sentry.dsn, SHOPPER_TILL_HOST: dyingHost });
  await once(child, "close");
  await expect
    .poll(() => sentry.items.filter((item) => item.type === "event").length, { timeout: 30_000 })
    .toBe(1);
  const event = sentry.items.find((item) => item.type === "event")!;
  expect(event.body).toMatchObject({
    release: `shopper-register@${buildInfo.version}`,
    tags: expect.objectContaining({ channel: "stable", register: "Register 1" }),
  });
  expect(JSON.stringify(event.body)).toContain("Register could not start");
  for (const item of sentry.items) {
    // The register fixture's device token, and the 64-hex database key loadSecrets sealed.
    expect(item.raw).not.toContain("a".repeat(64));
    expect(item.raw).not.toMatch(/key [0-9a-f]{64}/);
    expect(item.raw).not.toContain("0244123456");
  }
  expect(event.body).not.toHaveProperty("user.email");
}, 120_000);

test("with no DSN, nothing is sent", async () => {
  const sentry = await ingest();
  const { start } = await register(cleanup);
  const child = await start([], { SHOPPER_TILL_HOST: dyingHost });
  await once(child, "close");
  await new Promise((done) => setTimeout(done, 2_000));
  expect(sentry.items).toEqual([]);
}, 120_000);

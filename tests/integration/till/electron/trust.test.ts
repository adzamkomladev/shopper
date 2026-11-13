/// <reference types="node" />
// A till on the box's LAN pins the box's own CA at first run, and its host then trusts the box's certificate.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:https";
import { createServer as listenTcp } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { changeServer, findServer, pinBoxCa, trustsPinned } from "@shopper/till-electron/trust";

let dir: string;
let box: Server;
let served = "";
let upstream: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "shopper-trust-"));
  // A root CA and a leaf for 127.0.0.1 it signs, as Caddy's internal CA does for shopper.local.
  const openssl = (...args: string[]) =>
    execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
  openssl(
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-256",
    "-nodes",
    "-keyout",
    "ca.key",
    "-out",
    "ca.crt",
    "-days",
    "2",
    "-subj",
    "/CN=Shopper box CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign",
  );
  openssl(
    "req",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-256",
    "-nodes",
    "-keyout",
    "leaf.key",
    "-out",
    "leaf.csr",
    "-subj",
    "/CN=shopper.local",
  );
  await writeFile(join(dir, "leaf.ext"), "subjectAltName=IP:127.0.0.1,DNS:shopper.local\n");
  openssl(
    "x509",
    "-req",
    "-in",
    "leaf.csr",
    "-CA",
    "ca.crt",
    "-CAkey",
    "ca.key",
    "-CAcreateserial",
    "-out",
    "leaf.crt",
    "-days",
    "2",
    "-extfile",
    "leaf.ext",
  );
  const file = (name: string) => readFile(join(dir, name), "utf8");
  served = await file("ca.crt");
  box = createServer({ key: await file("leaf.key"), cert: await file("leaf.crt") }, (req, res) =>
    req.url === "/ca.crt" ? res.end(served) : res.end("box ok"),
  );
  await new Promise<void>((resolve) => box.listen(0, "127.0.0.1", resolve));
  upstream = `https://127.0.0.1:${(box.address() as { port: number }).port}`;
});
afterAll(async () => {
  box?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/** What the till host does first: a plain Node fetch to its upstream, with or without the pinned CA. */
const hostFetch = (ca?: string) =>
  promisify(execFile)(
    process.execPath,
    [
      "-e",
      `fetch(${JSON.stringify(upstream)}).then(r => r.text()).then(t => process.stdout.write(t))`,
    ],
    {
      env: { PATH: process.env.PATH, ...(ca ? { NODE_EXTRA_CA_CERTS: ca } : {}) },
    },
  );

test("the pinned CA lets the host reach the box over TLS; without it the box's certificate is refused", async () => {
  await expect(hostFetch()).rejects.toThrow();
  const pinned = await pinBoxCa(upstream, dir);
  expect(pinned).toBe(join(dir, "box-ca.pem"));
  expect((await hostFetch(pinned)).stdout).toBe("box ok");
});

test("only a CA is pinned, and a cloud upstream pins nothing", async () => {
  served = await readFile(join(dir, "leaf.crt"), "utf8");
  await expect(pinBoxCa(upstream, dir)).rejects.toThrow(/not a CA/);
  expect(await pinBoxCa("https://shopper-api.temtem.dev", dir)).toBeUndefined();
  expect(await pinBoxCa("http://shopper.local", dir)).toBeUndefined();
});

test("the updater trusts the box's chain only when it leads to the pinned CA and names the box", async () => {
  const pem = (name: string) => readFile(join(dir, name), "utf8");
  const ca = await pem("ca.crt");
  const chain = [await pem("leaf.crt"), ca];
  expect(trustsPinned(chain, "127.0.0.1", ca)).toBe(true);
  expect(trustsPinned(chain, "shopper.local", ca)).toBe(true);
  expect(trustsPinned(chain, "evil.example", ca)).toBe(false);
  // A chain the pinned CA never signed: its own root, or a leaf alone that only claims the issuer's name.
  const other = execFileSync("openssl", [
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-256",
    "-nodes",
    "-keyout",
    join(dir, "other.key"),
    "-days",
    "2",
    "-subj",
    "/CN=Shopper box CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign",
  ]).toString();
  expect(trustsPinned(chain, "127.0.0.1", other)).toBe(false);
  expect(trustsPinned([other], "127.0.0.1", ca)).toBe(false);
  // A leaf's key never issues certificates, even one whose own chain leads to the pinned CA.
  const openssl = (...args: string[]) =>
    execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
  openssl(
    "req",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-256",
    "-nodes",
    "-keyout",
    "forged.key",
    "-out",
    "forged.csr",
    "-subj",
    "/CN=evil.example",
  );
  await writeFile(join(dir, "forged.ext"), "subjectAltName=DNS:evil.example\n");
  openssl(
    "x509",
    "-req",
    "-in",
    "forged.csr",
    "-CA",
    "leaf.crt",
    "-CAkey",
    "leaf.key",
    "-CAcreateserial",
    "-out",
    "forged.crt",
    "-days",
    "2",
    "-extfile",
    "forged.ext",
  );
  expect(trustsPinned([await pem("forged.crt"), chain[0]!, ca], "evil.example", ca)).toBe(false);
});

const cloud = "https://shopper-api.temtem.dev";

// First run on a shop LAN: a box that hands over its CA is the server; anything else leaves the build's cloud.
test("first run enrols with a box that answers, and falls back to the cloud when none does", async () => {
  served = await readFile(join(dir, "ca.crt"), "utf8");
  expect(await findServer(upstream, cloud, dir)).toEqual({
    upstream,
    ca: join(dir, "box-ca.pem"),
  });
  await rm(join(dir, "box-ca.pem"));
  expect(await findServer("https://127.0.0.1:1", cloud, dir)).toEqual({ upstream: cloud });
  // A name that answers with a leaf is not a box: nothing is pinned.
  served = await readFile(join(dir, "leaf.crt"), "utf8");
  expect(await findServer(upstream, cloud, dir)).toEqual({ upstream: cloud });
  await expect(readFile(join(dir, "box-ca.pem"))).rejects.toThrow();
});

test("a box that accepts the connection but never answers costs at most a few seconds", async () => {
  const silent = listenTcp(() => {});
  await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
  const started = Date.now();
  const found = await findServer(
    `https://127.0.0.1:${(silent.address() as { port: number }).port}`,
    cloud,
    dir,
  );
  silent.close();
  expect(found).toEqual({ upstream: cloud });
  expect(Date.now() - started).toBeLessThan(4_500);
});

// When mDNS is blocked the cashier types the box's address on the enrol screen.
test("a typed box address is pinned; a public name or a silent address is refused with why", async () => {
  served = await readFile(join(dir, "ca.crt"), "utf8");
  const port = new URL(upstream).port;
  expect(await changeServer(` 127.0.0.1:${port} `, dir)).toEqual({
    upstream,
    ca: join(dir, "box-ca.pem"),
  });
  expect(await changeServer(`https://127.0.0.1:${port}/`, dir)).toMatchObject({ upstream });
  await expect(changeServer("kumasi-mart.com", dir)).rejects.toThrow(/like 192\.168\.1\.20/);
  await expect(changeServer("not an address", dir)).rejects.toThrow(/like 192\.168\.1\.20/);
  await expect(changeServer("127.0.0.1:1", dir)).rejects.toThrow(
    /Nothing answered at 127\.0\.0\.1:1/,
  );
  served = await readFile(join(dir, "leaf.crt"), "utf8");
  await expect(changeServer(`127.0.0.1:${port}`, dir)).rejects.toThrow(/not a Shopper box/);
});

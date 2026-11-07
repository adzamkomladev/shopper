/// <reference types="node" />
// A till on the box's LAN pins the box's own CA at first run, and its host then trusts the box's certificate.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pinBoxCa } from "@shopper/till-electron/trust";

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

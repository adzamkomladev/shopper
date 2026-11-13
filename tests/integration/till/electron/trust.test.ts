/// <reference types="node" />
// A till on the box's LAN pins the box's own CA at first run, and its host then trusts the box's certificate.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { execFile, execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { pinBoxCa, trustsPinned } from "@shopper/till-electron/trust";
import { startPinnedBox } from "../../../support/till/box";

let dir: string;
let box: Awaited<ReturnType<typeof startPinnedBox>> | undefined;
let upstream: string;

beforeAll(async () => {
  box = await startPinnedBox();
  dir = box.dir;
  upstream = box.upstream;
});
afterAll(async () => box?.close());

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
  await box!.serve("leaf.crt");
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

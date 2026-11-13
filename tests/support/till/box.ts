import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A stand-in for a box on the LAN: a root CA and a leaf for 127.0.0.1 and shopper.local it signs (as Caddy's internal
 * CA does), and an HTTPS server that serves `/ca.crt`. `serve` swaps what `/ca.crt` answers with (`ca.crt`, `leaf.crt`).
 */
export async function startPinnedBox() {
  let served = "";

  const dir = await mkdtemp(join(tmpdir(), "shopper-trust-"));
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
  const box = createServer(
    { key: await file("leaf.key"), cert: await file("leaf.crt") },
    (req, res) => (req.url === "/ca.crt" ? res.end(served) : res.end("box ok")),
  );
  await new Promise<void>((resolve) => box.listen(0, "127.0.0.1", resolve));
  const upstream = `https://127.0.0.1:${(box.address() as { port: number }).port}`;
  return {
    dir,
    upstream,
    serve: async (name: string) => {
      served = await file(name);
    },
    close: async () => {
      box.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

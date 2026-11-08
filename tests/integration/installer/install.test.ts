// A store server installs from one file with no network, in well under 30 minutes, and a file that is not Shopper's is refused
// before anything on the machine changes.
import { generateKeyPairSync } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { generateKey } from "@shopper/core/licence";
import { buildInstaller, downloadDebs } from "../../../tooling/installer/build";
import { bareMachine } from "../../support/installer/machine";

let dir: string;
let machine: ReturnType<typeof bareMachine>;
let release: Awaited<ReturnType<typeof generateKey>>;
const journal = async () =>
  (
    JSON.parse(
      await readFile(
        new URL("../../../packages/db/pg/migrations/meta/_journal.json", import.meta.url),
        "utf8",
      ),
    ) as { entries: unknown[] }
  ).entries.length;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "shopper-install-test-"));
  release = await generateKey();
  // Packages are downloaded once per checkout; the machine under test never has a network.
  const debs = join(process.cwd(), ".shopper", "installer-debs");
  if (!existsSync(join(debs, "..", "installer-debs.done"))) {
    await rm(debs, { recursive: true, force: true });
    downloadDebs(debs);
    await writeFile(join(debs, "..", "installer-debs.done"), "");
  }
  const portal = join(dir, "portal");
  await mkdir(portal);
  await writeFile(join(portal, "index.html"), "<!doctype html><title>Shopper</title>");
  await buildInstaller({
    out: join(dir, "installer.run"),
    releaseKey: release.privateKey,
    portal,
    debs,
  });
  machine = bareMachine(`shopper-install-${process.pid}`, join(dir, "installer.run"));
}, 900_000);
afterAll(async () => {
  machine?.destroy();
  await rm(dir, { recursive: true, force: true });
});

test("an installer that is altered, or not signed by Shopper, is refused before anything is installed", async () => {
  const original = await readFile(join(dir, "installer.run"));
  // One byte inside the tar payload.
  const damaged = Buffer.from(original);
  damaged[damaged.length - 5000] ^= 0xff;
  await writeFile(join(dir, "damaged.run"), damaged);
  // Shopper's key swapped for another, as an attacker repacking the file would.
  const other = generateKeyPairSync("ed25519")
    .publicKey.export({ type: "spki", format: "pem" })
    .toString()
    .trim();
  const header = original.subarray(0, 4000).toString("latin1");
  const swapped = header.replace(
    /-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/,
    other,
  );
  await writeFile(
    join(dir, "foreign.run"),
    Buffer.concat([Buffer.from(swapped, "latin1"), original.subarray(4000)]),
  );
  for (const [file, message] of [
    ["damaged.run", /damaged|altered|does not unpack/],
    ["foreign.run", /not signed by Shopper/],
  ] as const) {
    machine.copyIn(join(dir, file), `/var/tmp/${file}`);
    const result = machine.run(`sh /var/tmp/${file}`);
    expect(result.status).not.toBe(0);
    expect(result.output).toMatch(message);
  }
  // Nothing was installed: no PostgreSQL, no Shopper folder, no user.
  expect(machine.run("test ! -e /opt/shopper && ! command -v psql && ! id shopper").status).toBe(0);
}, 300_000);

test("a bare Ubuntu with no network becomes a running shop server in minutes, and installs only once", async () => {
  const started = Date.now();
  const result = machine.run("sh /installer.run");
  const minutes = (Date.now() - started) / 60_000;
  const journal_ =
    result.status === 0
      ? ""
      : machine.run(
          "journalctl -u shopper-box -u caddy -p warning --no-pager | tail -25 | cut -c1-260",
        ).output;
  expect(result.status, `${result.output.split("\n").slice(-8).join("\n")}\n${journal_}`).toBe(0);
  expect(result.output).toContain("Setup code (shown once");
  console.info(`installed and checked in ${minutes.toFixed(1)} min`);
  expect(minutes).toBeLessThan(30);

  for (const unit of ["postgresql", "caddy", "shopper-engine", "shopper-box"])
    expect(machine.run(`systemctl is-active ${unit}`).output.trim(), unit).toBe("active");
  // Migrations ran on the box's first start; Caddy's own CA answers for shopper.local.
  expect(
    machine
      .run(
        `su postgres -c "psql -d shopper -qAt -c 'select count(*) from drizzle.__drizzle_migrations'"`,
      )
      .output.trim(),
  ).toBe(String(await journal()));
  const https = machine.run(
    "curl -fsS --cacert /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt --resolve shopper.local:443:127.0.0.1 https://shopper.local/api/health",
  );
  expect(https.output).toContain('"status":"ok"');
  // The box's folder is exactly what Shopper signed, and its secrets are not readable by everyone.
  expect(machine.run("stat -c %a /etc/shopper/box.env").output.trim()).toBe("640");
  expect(machine.run("readlink /opt/shopper/current").output.trim()).toBe("/opt/shopper/slots/a");

  const again = machine.run("sh /installer.run");
  expect(again.status).not.toBe(0);
  expect(again.output).toContain("already has a Shopper box");
}, 1_800_000);

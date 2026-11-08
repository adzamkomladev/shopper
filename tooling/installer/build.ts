import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { chmod, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fromBase64Url, publicKeyOf, sign } from "../../packages/core/src/licence/keys";
import { sha256 } from "../../packages/utils/src/crypto";
import { sealBox } from "../box/seal";
import { writeManifest } from "../release/sign";
import pins from "./pins.json" with { type: "json" };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const docker = (...args: string[]) => execFileSync("docker", args, { stdio: "inherit" });

/**
 * Builds `shopper-box-installer.run`: a signed shell script with a tar payload (the sealed box, the pinned Rivet
 * engine, PostgreSQL 18 and the other packages as .deb files, units and config). Needs network and Docker once, here,
 * never on the customer's machine. `releaseKey` is the private release JWK; its public half is built into the box.
 */
export async function buildInstaller(options: {
  out: string;
  releaseKey: string;
  portal: string;
  /** Prebuilt .deb files to use instead of downloading them (tests). */
  debs?: string;
}) {
  const work = await mkdtemp(join(tmpdir(), "shopper-installer-"));
  const payload = join(work, "payload");
  const slot = join(payload, "slot");
  await mkdir(join(slot, "engine"), { recursive: true });
  await sealBox({
    out: join(slot, "shopper-box"),
    portal: options.portal,
    env: { SHOPPER_RELEASE_KEY: publicKeyOf(options.releaseKey) },
  });
  copyEngine(join(slot, "engine", "rivet-engine"));
  await writeManifest(slot, options.releaseKey, { kind: "install" });
  if (options.debs) await cp(options.debs, join(payload, "debs"), { recursive: true });
  else downloadDebs(join(payload, "debs"));
  await cp(join(root, "apps/box/deploy"), join(payload, "deploy"), { recursive: true });
  await cp(join(root, "tooling/installer/install.sh"), join(payload, "install.sh"));
  await signPayload(payload, options.releaseKey);
  execFileSync("tar", ["-czf", join(work, "payload.tgz"), "-C", work, "payload"]);
  await writeFile(
    options.out,
    await withHeader(await readFile(join(work, "payload.tgz")), options.releaseKey),
  );
  await chmod(options.out, 0o755);
  await rm(work, { recursive: true, force: true });
}

/** The engine binary comes from the pinned image: no second copy of the engine's version to keep in step. */
function copyEngine(to: string) {
  const name = `shopper-engine-${process.pid}`;
  docker("create", "--name", name, pins.engineImage);
  try {
    docker("cp", `${name}:/usr/bin/rivet-engine`, to);
  } finally {
    docker("rm", name);
  }
}

/**
 * apt downloads the packages and everything they need that a minimal Ubuntu lacks. The PostgreSQL repository key is
 * checked against its pinned fingerprint in one container; the download runs in a second, bare one, so tools used to
 * fetch the key never hide a dependency the shop's own machine would be missing.
 */
export function downloadDebs(to: string) {
  const keys = mkdtempSync(join(tmpdir(), "shopper-pgdg-"));
  docker(
    "run",
    "--rm",
    "-v",
    `${keys}:/out`,
    `ubuntu:${pins.ubuntu}`,
    "sh",
    "-c",
    `set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq --no-install-recommends ca-certificates curl gnupg >/dev/null
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /tmp/pgdg.asc
gpg --show-keys --with-colons /tmp/pgdg.asc | awk -F: '/^fpr:/ {print $10; exit}' | grep -qx ${pins.pgdgKeyFingerprint}
gpg --dearmor < /tmp/pgdg.asc > /out/pgdg.gpg
chmod 644 /out/pgdg.gpg`,
  );
  // apt reads the key as its unprivileged user.
  chmodSync(keys, 0o755);
  mkdirSync(to, { recursive: true });
  docker(
    "run",
    "--rm",
    "-v",
    `${keys}:/keys:ro`,
    "-v",
    `${to}:/out`,
    `ubuntu:${pins.ubuntu}`,
    "sh",
    "-c",
    `set -eu
export DEBIAN_FRONTEND=noninteractive
echo "deb [signed-by=/keys/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt noble-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update -qq
apt-get install -y -qq --no-install-recommends --download-only ${pins.packages.join(" ")} >/dev/null
cp /var/cache/apt/archives/*.deb /out/`,
  );
  rmSync(keys, { recursive: true, force: true });
}

/** SHA256SUMS lists every payload file; Shopper's Ed25519 signature on it (checked with openssl on the machine) covers them all. */
async function signPayload(payload: string, releaseKey: string) {
  const files = (await readdir(payload, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => relative(payload, join(entry.parentPath, entry.name)))
    .sort((a, b) => a.localeCompare(b));
  const lines = await Promise.all(
    files.map(async (file) => `${await sha256(await readFile(join(payload, file)))}  ${file}`),
  );
  const sums = `${lines.join("\n")}\n`;
  await writeFile(join(payload, "SHA256SUMS"), sums);
  await writeFile(join(payload, "SHA256SUMS.sig"), fromBase64Url(await sign(releaseKey, sums)));
}

/** The script header carries the public key as PEM (Ed25519 SPKI) and the line where the tar payload starts. */
async function withHeader(tgz: Buffer, releaseKey: string) {
  const spki = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    Buffer.from(fromBase64Url(publicKeyOf(releaseKey))),
  ]);
  const pem = `-----BEGIN PUBLIC KEY-----\n${spki.toString("base64")}\n-----END PUBLIC KEY-----`;
  const template = (await readFile(join(root, "tooling/installer/header.sh"), "utf8")).replace(
    "@@PUBLIC_KEY@@",
    pem,
  );
  const lines = template.split("\n").length - 1;
  return Buffer.concat([Buffer.from(template.replace("@@PAYLOAD_LINE@@", String(lines + 1))), tgz]);
}

if (import.meta.main) {
  const flag = (name: string) => process.argv[process.argv.indexOf(name) + 1];
  const releaseKey = process.env.SHOPPER_RELEASE_SIGNING_KEY;
  if (!releaseKey) throw new Error("Set SHOPPER_RELEASE_SIGNING_KEY to the release private JWK");
  await buildInstaller({
    out: resolve(flag("--out") ?? join(root, "apps/box/dist/shopper-box-installer.run")),
    releaseKey,
    portal: resolve(flag("--portal") ?? join(root, "apps/portal/dist/client")),
  });
}

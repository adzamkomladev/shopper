// A store server installs from one file with no network, in well under 30 minutes, and a file that is not Shopper's is refused
// before anything on the machine changes.
import { generateKeyPairSync } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { generateKey } from "@shopper/core/licence";
import {
  boxState,
  brokenUpdate,
  journal,
  licenceFor,
  ownerApi,
  plugStick,
  secure,
  setUpBackups,
  tillFeed,
  until,
} from "../../support/installer/owner";
import { buildInstaller } from "../../../tooling/installer/build";
import { bareMachine, installerDebs } from "../../support/installer/machine";

let dir: string;
let machine: ReturnType<typeof bareMachine>;
let release: Awaited<ReturnType<typeof generateKey>>;
let issuer: Awaited<ReturnType<typeof generateKey>>;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "shopper-install-test-"));
  release = await generateKey();
  issuer = await generateKey();
  const debs = await installerDebs();
  const portal = join(dir, "portal");
  await mkdir(portal);
  await writeFile(join(portal, "index.html"), "<!doctype html><title>Shopper</title>");
  await buildInstaller({
    out: join(dir, "installer.run"),
    releaseKey: release.privateKey,
    portal,
    debs,
    env: { SHOPPER_LICENCE_ISSUER: issuer.publicKey },
    update: { out: join(dir, "update-good.tgz"), version: "9.9.9" },
  });
  await brokenUpdate(dir, release.privateKey);
  machine = bareMachine(`shopper-install-${process.pid}`, join(dir, "installer.run"));
}, 900_000);
afterAll(async () => {
  machine?.run("losetup -n -O NAME -j /stick.img | xargs -r -n1 losetup -d"); // loop devices are the host's
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
  expect(migrations()).toBe(String(await journal()));
  const https = machine.run(
    "curl -fsS --cacert /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt --resolve shopper.local:443:127.0.0.1 https://shopper.local/api/health",
  );
  expect(https.output).toContain('"status":"ok"');
  // First boot, through Caddy's TLS: /setup sends a browser to the wizard, and the printed code creates the shop.
  expect(
    machine.run(
      `${secure} -o /dev/null -w '%{http_code} %{redirect_url}' -H 'accept: text/html' https://shopper.local/setup`,
    ).output,
  ).toBe("302 https://shopper.local/install");
  const code = result.output.match(
    /Setup code \(shown once[^:]*: ([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/,
  )![1]!;
  const wizard = JSON.stringify({
    code,
    shop: { name: "Esi Mart", code: "esi-mart" },
    store: { name: "Osu" },
    owner: { name: "Esi Mensah", email: "esi@example.com", password: "a long enough passphrase" },
    licence: await licenceFor(machine, issuer.privateKey),
  });
  expect(
    machine.run(
      `${secure} -o /dev/null -w '%{http_code}' -H 'content-type: application/json' -d '${wizard.replaceAll("'", "")}' https://shopper.local/api/install`,
    ).output,
  ).toBe("201");
  expect(
    machine.run(`${secure} -o /dev/null -w '%{http_code}' https://shopper.local/api/install`)
      .output,
  ).toBe("404");
  expect(
    machine.run(
      `${secure} -o /dev/null -w '%{http_code}' -H 'content-type: application/json' -H 'origin: https://shopper.local' -d '{"email":"esi@example.com","password":"a long enough passphrase"}' https://shopper.local/api/auth/sign-in/email`,
    ).output,
  ).toBe("200");
  // The box's folder is exactly what Shopper signed, and its secrets are not readable by everyone.
  expect(machine.run("stat -c %a /etc/shopper/box.env").output.trim()).toBe("640");
  expect(machine.run("readlink /opt/shopper/current").output.trim()).toBe("/opt/shopper/slots/a");

  const again = machine.run("sh /installer.run");
  expect(again.status).not.toBe(0);
  expect(again.output).toContain("already has a Shopper box");
}, 1_800_000);

const box = () => boxState(machine);
const healthy = () => box().healthy();
const slot = () => box().slot();
const result = () => box().result();
const migrations = () => box().migrations();

test("the owner installs an update from the box (backup first, slot switch), and a broken one is switched back with its database restored", async () => {
  const api = ownerApi(machine);
  expect(api.signIn().status).toBe(200);
  // Air-gapped: the bundles come on a USB stick. Plugging it in starts shopper-usb@<device> (the udev rule; Docker has
  // no udev, so the test starts the unit). Only regular files named like a bundle are copied; the stick is let go.
  const stick = await plugStick(machine, dir, ["update-good.tgz", "update-broken.tgz"]);
  const copied = machine.run(`systemctl start shopper-usb@${stick}.service`);
  expect(copied.status, copied.output).toBe(0);
  expect(
    machine.run("ls -A /var/lib/shopper/updates").output.split("\n").filter(Boolean).sort(),
  ).toEqual(["update-broken.tgz", "update-forged.tgz", "update-good.tgz"]);
  expect(
    machine.run("stat -c '%U %a' /var/lib/shopper/updates/update-good.tgz").output.trim(),
  ).toBe("shopper 640");
  expect(machine.run(`findmnt -S /dev/${stick}`).status).not.toBe(0);
  machine.run(`losetup -d /dev/${stick}`);
  const listed = JSON.parse(api.call("GET", "/updates").text) as {
    running: { slot: string };
    bundles: Array<{ file: string; verdict: { ok: boolean } }>;
  };
  expect(listed.running.slot).toBe("a");
  expect(listed.bundles.map((bundle) => [bundle.file, bundle.verdict.ok]).sort()).toEqual([
    ["update-broken.tgz", true],
    ["update-good.tgz", true],
  ]); // the forged one is copied but never offered
  // The mandatory backup is not set up yet: the update is refused and nothing is switched.
  const refused = api.call("POST", "/updates/install", { file: "update-good.tgz" });
  expect(refused.status).toBe(409);
  expect(refused.text).toContain("verified backup");
  expect(slot()).toBe("/opt/shopper/slots/a");

  setUpBackups(machine);
  await until(healthy, 120, "the box to restart");
  api.signIn();
  const started = api.call("POST", "/updates/install", { file: "update-good.tgz" });
  const why =
    started.status === 202
      ? ""
      : machine.run("journalctl -u shopper-box --no-pager | grep -A12 update.failed | cut -c1-300")
          .output;
  expect(started.status, `${started.text}\n${why}`).toBe(202);
  await until(() => result() !== undefined, 240, "the update to be applied");
  expect(result()!.status).toBe("applied");
  expect(slot()).toBe("/opt/shopper/slots/b");
  await until(healthy, 60, "the updated box");
  expect(
    machine.run("ls /var/lib/shopper/backup-remote | grep -c '\\.dump\\.age$'").output.trim(),
  ).toBe("1");
  api.signIn();
  expect(
    (JSON.parse(api.call("GET", "/updates").text) as { running: { slot: string } }).running.slot,
  ).toBe("b");

  // A signed bundle whose box does not start: the helper waits, switches back and says so.
  expect(api.call("POST", "/updates/install", { file: "update-broken.tgz" }).status).toBe(202);
  await until(() => result()?.status === "rolled_back", 300, "the broken update to be rolled back");
  expect(slot()).toBe("/opt/shopper/slots/b");
  await until(healthy, 60, "the box after rollback");
  // The box's own reason, and the database put back as it was before the update; the changed one is kept for support.
  expect(result()!.message).toContain(
    "9.9.10 did not start: migration 9999_drill failed: division by zero.",
  );
  expect(result()!.message).toContain("restored from the backup taken before the update");
  expect(migrations()).toBe(String(await journal()));
  expect(
    machine.run(`su postgres -c "psql -qAt -l" | grep -c '^shopper_failed_'`).output.trim(),
  ).toBe("1");
  expect(machine.run("ls /var/lib/shopper/updates/pre-update.dump 2>&1").status).not.toBe(0);
}, 1_800_000);

test("systemd brings a killed engine and a killed box back on their own", async () => {
  for (const unit of ["shopper-engine", "shopper-box"]) {
    const pid = () => machine.run(`systemctl show -p MainPID --value ${unit}`).output.trim();
    const before = pid();
    machine.run(`systemctl kill -s KILL ${unit}`);
    await until(
      () =>
        pid() !== before &&
        pid() !== "0" &&
        machine.run(`systemctl is-active ${unit}`).output.trim() === "active",
      60,
      `${unit} to restart`,
    );
  }
  await until(
    () => machine.run("curl -fsS http://127.0.0.1:3001/api/health/ready").status === 0,
    120,
    "the box to be ready again",
  );
  // Registers take their updates from the slot the box runs, through Caddy: by name, or by address where the network
  // blocks shopper.local (a certificate for the address, from the same CA the register pinned).
  for (const box of ["shopper.local", "127.0.0.1"])
    expect(tillFeed(machine, box)).toBe("version: 0.1.3\n");
}, 1_800_000);

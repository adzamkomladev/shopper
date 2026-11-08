import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { v7 } from "uuid";
import { issueLicence } from "@shopper/core/licence";
import { buildUpdate } from "../../../tooling/installer/update";
import type { bareMachine } from "./machine";

type Machine = ReturnType<typeof bareMachine>;
const PKI = "/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt";
export const secure = `curl -sS --cacert ${PKI} --resolve shopper.local:443:127.0.0.1`;

/** A licence for this machine, issued from the request code its first-boot wizard shows. */
export async function licenceFor(machine: Machine, issuerKey: string) {
  const state = JSON.parse(machine.run(`${secure} https://shopper.local/api/install`).output) as {
    licence: { request: string };
  };
  const request = JSON.parse(Buffer.from(state.licence.request, "base64url").toString("utf8")) as {
    machine: string;
    key: string;
  };
  return issueLicence(issuerKey, {
    id: v7(),
    org: v7(),
    site: "Osu",
    machine: request.machine,
    key: request.key,
    terminals: 5,
    issuedAt: new Date().toISOString(),
    maintenanceUntil: "2099-01-01",
  });
}

/** The owner's calls to the box through Caddy, signed in with a cookie jar. */
export function ownerApi(machine: Machine) {
  const call = (method: string, path: string, body?: unknown) => {
    const out = machine.run(
      `${secure} -c /root/jar -b /root/jar -X ${method} -H 'content-type: application/json' -H 'origin: https://shopper.local' -w '\\n%{http_code}' ${
        body === undefined ? "" : `-d '${JSON.stringify(body)}'`
      } https://shopper.local/api${path}`,
    ).output;
    const at = out.lastIndexOf("\n");
    return { status: Number(out.slice(at + 1)), text: out.slice(0, at) };
  };
  return {
    call,
    signIn: () =>
      call("POST", "/auth/sign-in/email", {
        email: "esi@example.com",
        password: "a long enough passphrase",
      }),
  };
}

/** Backups set up the way a site's installer would: an age recipient and a local rclone remote. */
export function setUpBackups(machine: Machine) {
  const recipient = machine
    .run("age-keygen -o /root/age.txt 2>&1 | sed -n 's/^Public key: //p'")
    .output.trim();
  machine.run(
    `install -d -o shopper -g shopper /var/lib/shopper/backup-remote && printf 'SHOPPER_BACKUP_RECIPIENT=${recipient}\\nSHOPPER_BACKUP_REMOTE=/var/lib/shopper/backup-remote\\n' > /etc/shopper/backup.env && chown root:shopper /etc/shopper/backup.env && chmod 640 /etc/shopper/backup.env && systemctl restart shopper-box`,
  );
}

/** A signed bundle whose "box" cannot start, to prove a bad update is switched back. */
export async function brokenUpdate(dir: string, releaseKey: string) {
  const { mkdir } = await import("node:fs/promises");
  const source = join(dir, "broken-slot");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "shopper-box"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  await buildUpdate({
    slot: source,
    out: join(dir, "update-broken.tgz"),
    releaseKey,
    version: "9.9.10",
  });
}

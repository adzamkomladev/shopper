import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { downloadDebs } from "../../../tooling/installer/build";

const IMAGE = "shopper-installer-test:24.04-2";

/** An Ubuntu 24.04 with systemd as PID 1 and no network, like a store server before its first install. */
export function bareMachine(name: string, installer: string) {
  if (spawnSync("docker", ["image", "inspect", IMAGE], { stdio: "ignore" }).status !== 0)
    buildImage();
  docker(
    "run",
    "-d",
    "--name",
    name,
    "--privileged",
    "--cgroupns=host",
    "--network",
    "none",
    "--tmpfs",
    "/run",
    "--tmpfs",
    "/tmp",
    "-v",
    "/sys/fs/cgroup:/sys/fs/cgroup:rw",
    "-v",
    `${installer}:/installer.run:ro`,
    IMAGE,
    "/sbin/init",
  );
  // Booted means systemd finished starting units (degraded is fine in a container).
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = spawnSync("docker", ["exec", name, "systemctl", "is-system-running"])
      .stdout.toString()
      .trim();
    if (state === "running" || state === "degraded") break;
    execFileSync("sleep", ["1"]);
  }
  return {
    /** Runs a command in the machine; never throws, so a refusal can be asserted. */
    run: (command: string) => {
      const result = spawnSync("docker", ["exec", name, "sh", "-c", command], {
        maxBuffer: 1 << 26,
      });
      return { status: result.status, output: `${result.stdout}${result.stderr}` };
    },
    copyIn: (from: string, to: string) => execFileSync("docker", ["cp", from, `${name}:${to}`]),
    destroy: () => spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" }),
  };
}

const docker = (...args: string[]) => execFileSync("docker", args, { stdio: "ignore" });

// Built with network, once; the machine itself never has any.
function buildImage() {
  execFileSync("docker", ["build", "-t", IMAGE, "-"], {
    input: `FROM ubuntu:24.04
RUN apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends systemd systemd-sysv dbus curl openssl ca-certificates iproute2 && rm -rf /var/lib/apt/lists/* /usr/sbin/policy-rc.d
STOPSIGNAL SIGRTMIN+3
`,
    stdio: ["pipe", "ignore", "inherit"],
  });
}

/** The Ubuntu packages the installer carries, downloaded once per checkout; the machine under test never has a network. */
export async function installerDebs() {
  const debs = join(process.cwd(), ".shopper", "installer-debs");
  if (existsSync(join(debs, "..", "installer-debs.done"))) return debs;
  await rm(debs, { recursive: true, force: true });
  downloadDebs(debs);
  await writeFile(join(debs, "..", "installer-debs.done"), "");
  return debs;
}

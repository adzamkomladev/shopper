// The Electron main process's update policy (apps/till/electron/src/updates.ts) against a local HTTP feed laid out as
// the R2 bucket is: /pilot/latest.yml and /stable/latest.yml, each beside its installer. The updater under it is a
// small stand-in for electron-updater's generic provider (fetch latest.yml, compare, download), because the real one
// only runs inside a packaged Electron app; the policy drives it through the same methods and events.
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { EventEmitter } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { compareVersions } from "@shopper/utils";
import { createUpdates } from "@shopper/till-electron/updates";
import type { UpdateState } from "@shopper/till-electron/types";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBoxApp } from "@shopper/box";
import { createHostUpdates } from "@shopper/adapters-box/till";
import { serveHono } from "../../support/till/http";

const current = "0.1.0";
let server: Server;
let feed = "";
let releases: Record<string, string | null>;
let updates: ReturnType<typeof createUpdates> | undefined;
beforeEach(async () => {
  releases = { pilot: "0.1.1", stable: "0.1.0" };
  server = createServer((request, response) => {
    const [, channel, file] = new URL(request.url ?? "/", "http://feed").pathname.split("/");
    const version = channel ? releases[channel] : undefined;
    if (!version) return void response.writeHead(503).end();
    if (file === "latest.yml")
      return void response.end(
        `version: ${version}\npath: Shopper-Setup-${version}-x64.exe\nsha512: none\n`,
      );
    response.end(Buffer.alloc(64 * 1024, 1));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  feed = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  updates?.stop();
  updates = undefined;
  server.close();
  await once(server, "close");
});

test("the feed follows the channel the host reports, and a newer version downloads until ready", async () => {
  const { updater, states } = start();
  updates!.policy({ channel: "stable", required: false, shiftOpen: false });
  await expect.poll(() => states.at(-1)?.state).toBe("idle");
  expect(updater.urls).toEqual([`${feed}/stable/`]);

  updates!.policy({ channel: "pilot", required: false, shiftOpen: false });
  await expect.poll(() => states.at(-1)?.state).toBe("ready");
  expect(updater.urls).toEqual([`${feed}/stable/`, `${feed}/pilot/`]);
  const path = states.map((state) => state.state);
  expect(path.indexOf("available")).toBeLessThan(path.indexOf("downloading"));
  expect(path.indexOf("downloading")).toBeLessThan(path.indexOf("ready"));
  expect(states.at(-1)).toEqual({ state: "ready", version: "0.1.1", percent: 100 });
  // Not required and nobody asked: it waits for the next restart.
  expect(updater.installs).toBe(0);
  expect(updater.autoInstallOnAppQuit).toBe(true);
});

test("a ready update never installs during a shift; it does once the shift closes and the cashier confirms", async () => {
  const { updater, states } = start();
  updates!.policy({ channel: "pilot", required: true, shiftOpen: true });
  await expect.poll(() => states.at(-1)?.state).toBe("ready");
  expect(updater.installs).toBe(0);
  expect(updates!.install()).toBe(false);
  expect(updater.installs).toBe(0);

  updates!.policy({ channel: "pilot", required: false, shiftOpen: false });
  expect(updater.installs).toBe(0);
  expect(updates!.install()).toBe(true);
  expect(updater.installs).toBe(1);
});

test("a required update with no shift open installs as soon as it is ready", async () => {
  const { updater, states } = start();
  updates!.policy({ channel: "pilot", required: true, shiftOpen: false });
  await expect.poll(() => states.at(-1)?.state).toBe("ready");
  expect(updater.installs).toBe(1);
});

test("a ready update stays ready when the shop moves to a channel with nothing newer", async () => {
  const { states } = start();
  updates!.policy({ channel: "pilot", required: false, shiftOpen: false });
  await expect.poll(() => states.at(-1)?.state).toBe("ready");
  updates!.policy({ channel: "stable", required: false, shiftOpen: false });
  // The download still installs on the next quit, so the till must keep saying so.
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(states.at(-1)).toEqual({ state: "ready", version: "0.1.1", percent: 100 });
  expect(updates!.install()).toBe(true);
});

test("a feed that is down leaves the register usable with the state at error", async () => {
  releases.stable = null;
  const { updater, states } = start();
  updates!.policy({ channel: "stable", required: true, shiftOpen: false });
  await expect.poll(() => states.at(-1)?.state).toBe("error");
  expect(updater.installs).toBe(0);
  expect(updates!.install()).toBe(false);
});

test("Retry after the feed was down reads it again and downloads", async () => {
  releases.stable = null;
  const { states } = start();
  updates!.policy({ channel: "stable", required: false, shiftOpen: false });
  await expect.poll(() => states.at(-1)?.state).toBe("error");
  releases.stable = "0.1.2";
  updates!.check();
  await expect
    .poll(() => states.at(-1))
    .toEqual({ state: "ready", version: "0.1.2", percent: 100 });
});

function start() {
  const updater = new FeedUpdater();
  const states: UpdateState[] = [];
  updates = createUpdates(updater as never, feed, (state) => states.push(state));
  return { updater, states };
}

/** electron-updater's generic provider, reduced to what the policy uses: one feed URL, one yml, one download. */
class FeedUpdater extends EventEmitter {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  urls: string[] = [];
  installs = 0;
  setFeedURL(options: { provider: string; url: string }) {
    expect(options.provider).toBe("generic");
    this.urls.push(options.url);
  }
  async checkForUpdates() {
    const url = this.urls.at(-1)!;
    this.emit("checking-for-update");
    try {
      const yml = await fetch(`${url}latest.yml`);
      if (!yml.ok) throw new Error(`Feed answered ${yml.status}`);
      const text = await yml.text();
      const field = (name: string) => new RegExp(`^${name}: (.+)$`, "m").exec(text)![1]!;
      const info = { version: field("version"), path: field("path") };
      if (compareVersions(info.version, current) <= 0)
        return void this.emit("update-not-available", info);
      this.emit("update-available", info);
      if (!this.autoDownload) return;
      const bytes = await (await fetch(`${url}${info.path}`)).arrayBuffer();
      this.emit("download-progress", { percent: 50, total: bytes.byteLength });
      this.emit("download-progress", { percent: 100, total: bytes.byteLength });
      this.emit("update-downloaded", info);
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }
  quitAndInstall() {
    this.installs += 1;
  }
}

// Notion Day 39 drill: after a box update, its registers update from the box. A box LAN has no route to the cloud feed,
// so the box serves the running slot's till/ folder and its handshake names that path; the register's host resolves it
// on the box's origin and the updater downloads from there. On the cloud no feed is named and the build's is kept.
test("on a box LAN the register takes its update from the box's running slot", async () => {
  const release = await mkdtemp(join(tmpdir(), "shopper-tillfeed-"));
  await mkdir(join(release, "till", "stable"), { recursive: true });
  await writeFile(
    join(release, "till", "stable", "latest.yml"),
    "version: 0.1.3\npath: Shopper-Setup-0.1.3-x64.exe\nsha512: none\n",
  );
  await writeFile(join(release, "till", "stable", "Shopper-Setup-0.1.3-x64.exe"), "installer");
  await writeFile(join(release, "manifest.json"), "{}");
  const box = await serveHono(createBoxApp({ SHOPPER_RELEASE_DIR: release }));
  try {
    const sent: Array<Record<string, unknown>> = [];
    const host = createHostUpdates((message) => sent.push(message as never), `${box.url}/api`);
    host.handshake({ updateChannel: "stable", updateFeed: "/till/updates" });
    host.tell(false);
    expect(sent.at(-1)).toEqual({
      type: "update-policy",
      channel: "stable",
      required: false,
      shiftOpen: false,
      feed: `${box.url}/till/updates`,
    });
    // This build has no feed of its own; the box's is the one it reads.
    const updater = new FeedUpdater();
    const states: UpdateState[] = [];
    updates = createUpdates(updater as never, "", (state) => states.push(state));
    updates.policy(sent.at(-1) as never);
    await expect
      .poll(() => states.at(-1))
      .toEqual({ state: "ready", version: "0.1.3", percent: 100 });
    expect(updater.urls).toEqual([`${box.url}/till/updates/stable/`]);
    // Only the slot's till/ folder is served.
    for (const path of [
      "/till/updates/stable/..%2f..%2fmanifest.json",
      "/till/updates/beta/latest.yml",
    ])
      expect(await (await fetch(`${box.url}${path}`)).text()).not.toContain("version: 0.1.3");

    // The cloud names no feed: the policy carries none and the build's feed stays.
    host.handshake({ updateChannel: "stable" });
    host.tell(true);
    expect(sent.at(-1)).not.toHaveProperty("feed");
  } finally {
    await box.close();
    await rm(release, { recursive: true, force: true });
  }
});

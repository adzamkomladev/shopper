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

test("a feed that is down leaves the register usable with the state at error", async () => {
  releases.stable = null;
  const { updater, states } = start();
  updates!.policy({ channel: "stable", required: true, shiftOpen: false });
  await expect.poll(() => states.at(-1)?.state).toBe("error");
  expect(updater.installs).toBe(0);
  expect(updates!.install()).toBe(false);
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

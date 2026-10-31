// The server's minimum till version: the handshake names it and the org's update channel. A register built below it
// reports `update.required`, keeps uploading the sales it already has and keeps selling on its open shift, but
// refuses to open a new shift until it updates.
import { afterEach, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { compareVersions } from "@shopper/utils";
import { api, appVersion, setMinTillVersion, syncProtocol } from "../../support/till/server";
import { syncHeaders } from "../../support/till/requests";
import { startRegister, type Register } from "../../support/hardware/host";

let register: Register | undefined;
afterEach(async () => {
  setMinTillVersion("");
  await register?.close();
  register = undefined;
});

const handshake = async () =>
  (
    await api.request("/sync/handshake", {
      method: "POST",
      headers: syncHeaders(),
      body: JSON.stringify({ requestId: v7(), appVersion, protocol: syncProtocol }),
    })
  ).json();

test("the handshake names the minimum till version and the org's update channel", async () => {
  expect(await handshake()).toMatchObject({ minTillVersion: null, updateChannel: "stable" });
  setMinTillVersion("0.1.1");
  expect(await handshake()).toMatchObject({ minTillVersion: "0.1.1", updateChannel: "stable" });
});

test("a register below the minimum uploads its sale and sells on its open shift", async () => {
  setMinTillVersion("99.0.0");
  register = await startRegister({ upstream: api.url });
  await expect
    .poll(async () => (await register!.status()).update, { timeout: 15_000 })
    .toMatchObject({ required: true, minVersion: "99.0.0", channel: "stable" });
  // The shift was open before the update was required: selling on it still completes and uploads.
  const { saleId } = await register.sell([{ kind: "cash", amount: 12_000 }]);
  expect(saleId).toEqual(expect.any(String));
  await expect
    .poll(async () => (await register!.status()).pendingCount, { timeout: 15_000 })
    .toBe(0);
});

test("a register below the minimum cannot open a new shift", async () => {
  setMinTillVersion("99.0.0");
  register = await startRegister({ upstream: api.url, shift: false });
  await expect
    .poll(async () => (await register!.status()).update?.required, { timeout: 15_000 })
    .toBe(true);
  expect(await register.ask({ type: "shift.open", float: 1_000_000 })).toMatchObject({
    type: "error",
    code: "UPDATE_REQUIRED",
  });
  expect((await register.status()).shift.current).toBeNull();
  expect(await register.audit("shift.open")).toHaveLength(0);
});

test("a register at the minimum is not blocked", async () => {
  setMinTillVersion(appVersion);
  register = await startRegister({ upstream: api.url, shift: false });
  await expect
    .poll(async () => (await register!.status()).update, { timeout: 15_000 })
    .toMatchObject({ required: false, minVersion: appVersion });
  expect(await register.ask({ type: "shift.open", float: 1_000_000 })).toMatchObject({
    type: "result",
    status: { shift: { current: { status: "open" } } },
  });
});

test("versions order by number, and a prerelease is below its release", () => {
  expect(compareVersions("0.1.10", "0.1.9")).toBeGreaterThan(0);
  expect(compareVersions("0.1.1-rc.1", "0.1.1")).toBeLessThan(0);
  expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
});

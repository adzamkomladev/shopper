import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v7 } from "uuid";
import { startBridgeProxy } from "../connection/proxy";
import { startTillHost } from "../host/process";
import { startUpstream } from "../upstream";

export const SHOP = { slug: "kumasi-mart", id: v7(), name: "Kumasi Mart" };
export const GOOD_CODE = "424242";

/**
 * A register host fresh from the installer (no identity), behind the bridge proxy, and a stub server with one shop
 * and one good code. `state.mode` makes enrolment answer 429 (locked) or not at all (down).
 */
export async function startEnrolScenario(appOrigin: string) {
  const state = { mode: "ok" as "ok" | "locked" | "down", enrolled: 0 };
  const ids = { deviceId: v7(), storeId: v7(), branchId: v7() };
  const upstream = await startUpstream(async (request) => {
    const path = new URL(request.url).pathname;
    if (state.mode === "down") return Response.json({ error: "Unavailable" }, { status: 503 });
    if (path === `/orgs/${SHOP.slug}`) return Response.json({ id: SHOP.id, name: SHOP.name });
    if (path.startsWith("/orgs/"))
      return Response.json({ error: "Record not found" }, { status: 404 });
    if (path === "/devices/enroll") {
      if (state.mode === "locked") return Response.json({ error: "Locked" }, { status: 429 });
      const body = (await request.json()) as { code: string };
      if (body.code !== GOOD_CODE || state.enrolled > 0)
        return Response.json({ error: "Invalid enrolment code" }, { status: 401 });
      state.enrolled += 1;
      return Response.json({
        ...ids,
        deviceToken: "d".repeat(64),
        branchName: "Adum",
        receiptCodes: { branchCode: "BR01", deviceCode: "T01" },
      });
    }
    return Response.json({ error: "Unavailable" }, { status: 503 });
  });
  const directory = await mkdtemp(join(tmpdir(), "shopper-enrol-ui-"));
  const cleanups: (() => Promise<unknown>)[] = [
    () => upstream.close(),
    () => rm(directory, { recursive: true, force: true }),
  ];
  const stop = async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  };
  try {
    const config = {
      sqlitePath: join(directory, "till.sqlite"),
      upstream: upstream.url,
      origins: [appOrigin],
      port: 0,
    };
    const host = await startTillHost(config);
    cleanups.push(() => host.stop());
    // Under a parent the host hands the registration back and waits to be started with it, as Electron does.
    void host
      .waitForMessage((message) => message.type === "enrolled", 120_000)
      .then((message) =>
        host.child.send({
          type: "start",
          config: { ...config, ...(message.registration as object), session: null },
        }),
      )
      .catch(() => undefined);
    const bridge = await startBridgeProxy(host.ready.port, false);
    cleanups.push(() => bridge.close());
    return {
      url: `${appOrigin}/#${encodeURIComponent(host.ready.capability)}`,
      state,
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

import { createConnectionHost } from "../connection/host";
import { startBridgeProxy } from "../connection/proxy";
import { createConnectionServer } from "../connection/server";
import { ama, kofi, startStaffUpstream, type Staff } from "../host/staff/upstream";

export { ama, kofi };
/** Reports and stock only: lands on Dashboard, not Checkout. */
export const esi: Staff = {
  userId: ama.userId.replace(/.$/, "9"),
  name: "Esi Owusu",
  email: "esi@shop.test",
  password: "esi password 12",
  permissions: ["report.read", "stock.read"],
};

/**
 * A real register host with nobody signed in, and a stub server that signs `ama`, `kofi` and `esi` in.
 * `staff.state.mode` makes the login 503 (unreachable) or 429 (locked).
 */
export async function startSignInScenario(appOrigin: string) {
  const server = await createConnectionServer("connected-empty");
  const cleanups: (() => Promise<unknown> | void)[] = [() => server.close()];
  const stop = async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  };
  try {
    const staff = await startStaffUpstream([ama, kofi, esi]);
    cleanups.push(() => staff.close());
    const fixture = await createConnectionHost(server, staff.url, appOrigin);
    cleanups.push(() => fixture.close());
    Object.assign(fixture.config, { session: null });
    const host = await fixture.start();
    const bridge = await startBridgeProxy(host.ready.port, false);
    cleanups.push(() => bridge.close());
    return {
      url: `${appOrigin}/#${encodeURIComponent(host.ready.capability)}`,
      staff,
      user: async () =>
        ((await host.request({ type: "status" })).status as { user: { offline: boolean } | null })
          .user,
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

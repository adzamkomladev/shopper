// A running register for the shift bridge suites: a signed-in cashier (shift.read and shift.write from the role, plus
// register.settings and report.read unless `permissions` says otherwise), a shift open unless `shift: false`, and a
// virtual printer: "up" (configured and listening), "down" (configured, nothing listening: restore with `restore()`)
// or "none" (no printer in the settings).
import { hashPin } from "@shopper/auth/devices";
import { refreshApprovers } from "@shopper/core/till";
import {
  freePort,
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
} from "../../hardware/host";
import { manager, pin } from "../approvers";
import { denominate } from "../close";

export { denominate, manager, pin };

type Options = {
  shift?: boolean;
  permissions?: readonly string[];
  printer?: "up" | "down" | "none";
};

export async function startShifter({ shift, permissions, printer = "up" }: Options = {}) {
  const register = await startRegister({
    shift,
    permissions: permissions ?? ["register.settings", "report.read"],
  });
  let live: Printer | undefined;
  let port: number | null = null;
  if (printer === "up") {
    live = await startPrinter();
    port = live.port;
  } else if (printer === "down") port = await freePort();
  if (port !== null) await register.configure(registerSettings(port));
  const shifter = {
    register,
    get printer() {
      if (!live) throw new Error("The virtual printer is not listening");
      return live;
    },
    /** Brings the printer back on the port the register is configured for. */
    async restore() {
      if (port === null) throw new Error("No printer is configured");
      live = await startPrinter(port);
      return live;
    },
    /** Jobs the virtual printer captured so far (none when it is down). */
    jobs: async () => (live ? live.jobs() : []),
    /** Syncs a manager (PIN `pin`) who may approve `permissions` onto the running register. */
    async syncApprover(permissions = ["shift.approve"]) {
      const { identity } = register.fixture.config;
      await refreshApprovers(
        register.fixture.database,
        { orgId: identity.orgId, deviceId: identity.deviceId, appVersion: "0.0.0-test" },
        {
          approvers: [
            { userId: manager, name: "Esi Manager", pinHash: await hashPin(pin), permissions },
          ],
          at: new Date(),
        },
      );
    },
    /** Declares cash `cash` as the fewest notes and coins (card and MoMo 0 unless given). */
    declare: (cash: number, over: Record<string, unknown> = {}) =>
      register.ask({
        type: "shift.declare",
        counts: denominate(cash),
        card: 0,
        momo: 0,
        ...over,
      }),
    async close() {
      await register.close();
      await live?.stop();
    },
  };
  return shifter;
}

export type Shifter = Awaited<ReturnType<typeof startShifter>>;

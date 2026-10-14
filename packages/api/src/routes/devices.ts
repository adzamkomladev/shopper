import { Hono } from "hono";
import * as v from "valibot";
import { DeviceError, type createDeviceService } from "@shopper/auth/devices";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

export function deviceRoutes(
  devices: ReturnType<typeof createDeviceService>,
  authentication: ApiAuthentication | undefined,
) {
  const app = new Hono<ApiEnvironment>();
  app.get("/devices", requirePermission(authentication, "device.read"), async (c) => {
    return c.json(await devices.list(c.get("principal")));
  });
  for (const [path, operation, permission] of [
    ["/devices/enrollment", "issueEnrollment", "device.enroll"],
    ["/devices/enroll", "enroll", null],
    ["/cashiers/pin", "assignPin", "cashier.pin.assign"],
    ["/cashiers/login", "login", null],
    ["/devices/revoke", "revoke", "device.revoke"],
  ] as const) {
    if (permission) app.use(path, requirePermission(authentication, permission));
    app.post(path, async (c) => {
      const principal = c.get("principal");
      let data: unknown;
      try {
        data = await c.req.json();
      } catch {
        return c.json({ error: "Invalid JSON" }, 400);
      }
      try {
        const result =
          operation === "enroll"
            ? await devices.enroll(data)
            : operation === "login"
              ? await devices.login(data)
              : operation === "issueEnrollment"
                ? await devices.issueEnrollment(principal!, data)
                : operation === "assignPin"
                  ? await devices.assignPin(principal!, data)
                  : await devices.revoke(principal!, data);
        return c.json(
          result,
          operation === "enroll" || operation === "issueEnrollment" ? 201 : 200,
        );
      } catch (error) {
        if (v.isValiError(error)) return c.json({ error: "Invalid request data" }, 400);
        if (error instanceof DeviceError) return c.json({ error: error.message }, error.status);
        throw error;
      }
    });
  }
  return app;
}

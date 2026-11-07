import { Hono } from "hono";
import { confirmLicence, publicKeyOf, verifySignedRequest } from "@shopper/core/licence";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

/**
 * The cloud confirms a box's licence-signed check-in (public on purpose: the signature is the credential); the box
 * shows its own licence to every member (the shell's banner) and checks in on an owner's request.
 */
export function licenceRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const signingKey = options.licenceSigningKey;
  if (signingKey)
    app.post("/licence/confirmations", async (c) => {
      const now = new Date();
      const licence = await verifySignedRequest(c.req.raw, {
        issuer: publicKeyOf(signingKey),
        now,
      });
      if (!licence) return c.json({ error: "Not a genuine licence check-in" }, 401);
      return c.json(await confirmLicence(signingKey, licence.id, now));
    });
  const box = options.licence;
  if (!box) return app;
  app.get("/licence", async (c) => {
    if (!(await options.authentication?.resolvePrincipal(c.req.raw)))
      return c.json({ error: "Authentication required" }, 401);
    return c.json(await box.status());
  });
  app.post(
    "/licence/checks",
    requirePermission(options.authentication, "billing.manage"),
    async (c) => c.json(await box.checkIn()),
  );
  return app;
}

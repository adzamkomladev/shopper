import * as v from "valibot";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import { AssetError, kybDocumentLink } from "@shopper/assets";
import { decideKyb } from "@shopper/core/kyb";
import {
  kybCaseFor,
  kybQueue,
  platformTenants,
  recordPlatformDecision,
  setTenantChannel,
} from "@shopper/core/platform";
import { org } from "@shopper/db-pg";
import { BlobUploadUnavailable, uuidV7Schema } from "@shopper/ports";
import { queueStatus, tenantChannel } from "../schemas/platform";
import { commandContext } from "./stock/context";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

type PlatformOptions = ApiOptions & { platform: NonNullable<ApiOptions["platform"]> };

/**
 * Shopper staff across shops, for the admin app: the tenants, and the KYB queue a reviewer decides. Only members of
 * the platform org (its code is `platform.orgSlug`) holding the platform permission get through; a shop's owner,
 * whatever their permissions in their own shop, is refused.
 */
export function platformRoutes(options: PlatformOptions) {
  const app = new Hono<ApiEnvironment>();
  const database = options.database!;
  const platformOrg = async () => {
    const [row] = await database
      .select({ id: org.id, name: org.name, slug: org.slug })
      .from(org)
      .where(eq(org.slug, options.platform.orgSlug));
    return row;
  };
  const staff =
    (code: string): MiddlewareHandler<ApiEnvironment> =>
    async (c, next) =>
      requirePermission(options.authentication, code)(c, async () => {
        if (c.get("principal").orgId !== (await platformOrg())?.id)
          return void (c.res = c.json({ error: "Permission denied" }, 403));
        await next();
      });
  const tenant = (c: Context<ApiEnvironment>) => v.parse(uuidV7Schema, c.req.param("orgId"));

  app.get("/platform/org", async (c) => {
    const found = await platformOrg();
    return found ? c.json(found) : c.json({ error: "No platform org" }, 404);
  });
  app.use("/platform/tenants", staff("platform.tenant.read"));
  app.use("/platform/tenants/:orgId/channel", staff("platform.tenant.update"));
  app.use("/platform/kyb", staff("platform.kyb.review"));
  app.use("/platform/kyb/*", staff("platform.kyb.review"));

  app.get("/platform/tenants", async (c) =>
    c.json(await platformTenants(database, c.get("principal").orgId)),
  );
  app.post("/platform/tenants/:orgId/channel", async (c) => {
    const orgId = tenant(c);
    const body = v.parse(tenantChannel, await c.req.json());
    await setTenantChannel(database, commandContext(c.get("principal")), {
      orgId,
      channel: body.channel,
    });
    return c.json({ id: orgId, updateChannel: body.channel });
  });
  app.get("/platform/kyb", async (c) =>
    c.json(await kybQueue(database, v.parse(queueStatus, c.req.query("status")))),
  );
  app.get("/platform/kyb/:orgId", async (c) => {
    const orgId = tenant(c);
    const found = await kybCaseFor(database, orgId);
    // Short-lived links to the scans. A host without object storage, or a scan no longer tracked, shows none, so
    // the reviewer still sees the case and the checks say whether the documents were verified.
    const link = (assetId: string) =>
      options.blobs
        ? kybDocumentLink(database, options.blobs, orgId, assetId).catch((error: unknown) => {
            if (error instanceof AssetError && error.status === 404) return null;
            if (error instanceof BlobUploadUnavailable) return null;
            throw error;
          })
        : null;
    return c.json({
      ...found,
      directors: await Promise.all(
        found.directors.map(async (director) => ({
          ...director,
          link: await link(director.cardAssetId),
        })),
      ),
      documents: await Promise.all(
        found.documents.map(async (document) => ({
          ...document,
          link: await link(document.assetId),
        })),
      ),
    });
  });
  app.post("/platform/kyb/:orgId/decision", async (c) => {
    const orgId = tenant(c);
    const body = await c.req.json().catch(() => undefined);
    const principal = c.get("principal");
    const decided = await decideKyb(
      database,
      { orgId, appVersion: buildInfo.version, queue: options.notifications },
      { ...(body as object), reviewerId: principal.userId },
    );
    await recordPlatformDecision(database, commandContext(principal), {
      orgId,
      version: decided.version,
      decision: decided.decision,
    });
    return c.json(await kybCaseFor(database, orgId));
  });
  app.onError(problem);
  return app;
}

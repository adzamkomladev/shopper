import { and, eq, lt } from "drizzle-orm";
import { org, relayBox, relayNonce, type ShopperDatabase } from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { verifySignedRequest, type Licence } from "../licence";
import { fromBase64Url, toBase64Url } from "../licence/keys";
import type { RelayBox } from "./types";

/** How long a used signature is remembered: a request is fresh for 5 minutes either side of its signing time. */
const REMEMBER_MS = 10 * 60_000;

/**
 * Who is calling the relay: a genuine, fresh, licence-signed request from a box enrolled with the relay org its
 * licence names, not revoked, with the Online Orders add-on and active maintenance, sending this signature for the
 * first time. Anything else is a refusal with its status.
 */
export async function relayAccess(
  db: ShopperDatabase,
  request: Request,
  options: { issuer: string; now?: Date },
): Promise<{ licence: Licence; box: RelayBox } | { status: 401 | 402 | 403; error: string }> {
  const now = options.now ?? new Date();
  const licence = await verifySignedRequest(request, { issuer: options.issuer, now });
  if (!licence) return { status: 401, error: "Not a genuine licensed box" };
  const [found] = await db
    .select({ box: relayBox })
    .from(relayBox)
    .innerJoin(org, and(eq(org.id, relayBox.orgId), eq(org.mode, "relay")))
    .where(and(eq(relayBox.licenceId, licence.id), eq(relayBox.orgId, licence.org)));
  const box = found?.box;
  if (!box) return { status: 403, error: "This box is not enrolled with a relay" };
  if (box.revokedAt) return { status: 403, error: "This licence has been revoked" };
  if (!box.onlineOrders)
    return { status: 403, error: "Online Orders is not switched on for this shop" };
  // Maintenance runs to the end of its Accra (UTC) day.
  if (licence.maintenanceUntil < now.toISOString().slice(0, 10))
    return { status: 402, error: "Support has ended. Renew it to keep Online Orders." };
  if (!(await spend(db, box, request.headers.get("shopper-signature")!, now)))
    return { status: 401, error: "This request was already used" };
  return { licence, box };
}

/** Whether an org is a relay (v1.5): its cloud back office only reads, and only its box writes. */
export async function isRelayOrg(db: ShopperDatabase, orgId: string) {
  const [row] = await db.select({ mode: org.mode }).from(org).where(eq(org.id, orgId));
  return row?.mode === "relay";
}

/** The box is alive. Liveness, not business data: no audit row (Day 49 pauses ordering when it stops). */
export async function relayHeartbeat(db: ShopperDatabase, box: RelayBox, now = new Date()) {
  await db.update(relayBox).set({ lastSeenAt: now }).where(eq(relayBox.id, box.id));
  return { seenAt: now.toISOString() };
}

/**
 * Records the signature as used, or false when it already was. Forgets signatures too old to be fresh again. The
 * decoded bytes are what count: the decoder accepts padding and whitespace, so another spelling is the same signature.
 */
async function spend(db: ShopperDatabase, box: RelayBox, signature: string, now: Date) {
  await db
    .delete(relayNonce)
    .where(
      and(
        eq(relayNonce.licenceId, box.licenceId),
        lt(relayNonce.seenAt, new Date(now.getTime() - REMEMBER_MS)),
      ),
    );
  const used = await db
    .insert(relayNonce)
    .values({
      orgId: box.orgId,
      licenceId: box.licenceId,
      digest: await sha256(toBase64Url(fromBase64Url(signature))),
      seenAt: now,
    })
    .onConflictDoNothing()
    .returning({ digest: relayNonce.digest });
  return used.length > 0;
}

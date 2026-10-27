import { and, asc, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as v from "valibot";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { auditAnchor, device, member, role, user } from "@shopper/db-pg";
import type { Delivery } from "@shopper/ports";
import { formatDay } from "@shopper/utils";
import type { StatementDeliveryDeps } from "../customers";
import { auditAnchorMessage } from "../schemas/audit/anchor";
import type { Queryable } from "../types";
import { auditStreams } from "./streams";

/** The anchor workflow's business key: one per org and UTC day (Accra keeps UTC all year). */
export const auditAnchorId = (orgId: string, day: string) => `anchor-${orgId}-${day}`;

/**
 * Publishes the head of the org chain (before this command's own row) and of every register chain as the day's
 * anchors, then queues one email per owner. Run as a checkpointed workflow step, so a rerun publishes nothing.
 */
export const publishAnchors = defineCommand({
  name: "audit.anchor",
  async run(tx, ctx, input: { day: string }) {
    const heads = (await auditStreams(tx, ctx.orgId)).flatMap((s) =>
      s.head ? [{ stream: s.stream, seq: s.head.seq, hash: s.head.hash }] : [],
    );
    if (heads.length)
      await tx.insert(auditAnchor).values(
        heads.map((h) => ({
          orgId: ctx.orgId,
          day: input.day,
          stream: h.stream,
          chainSeq: h.seq,
          hash: h.hash,
        })),
      );
    const owners = await orgOwners(tx, ctx.orgId);
    for (const owner of owners)
      enqueueAfterCommit(tx, {
        id: v7(),
        orgId: ctx.orgId,
        v: 1,
        sequence: "0",
        type: "audit.anchor",
        payload: { day: input.day, userId: owner.id },
      });
    return { anchors: heads, owners: owners.length };
  },
  audit: (input, output) => ({ day: input.day, ...output }),
  // audit_log.entity_id is a uuid; the day is in the payload.
  details: () => ({ entity: "audit_anchor" }),
});

/** The org's owners (the protected owner role), in a stable order: who the daily emails go to. */
export const orgOwners = (db: Queryable, orgId: string) =>
  db
    .select({ id: member.userId })
    .from(member)
    .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
    .where(and(eq(member.orgId, orgId), eq(role.protectedOwner, true)))
    .orderBy(asc(member.userId));

/** Emails one owner the day's anchors; without mail or a portal origin the message retries rather than vanish. */
export async function deliverAuditAnchor(
  deps: Pick<StatementDeliveryDeps, "db" | "appVersion" | "mail" | "baseUrl">,
  delivery: Delivery,
) {
  const message = v.parse(auditAnchorMessage, delivery.message);
  if (!deps.mail || !deps.baseUrl) return await delivery.retry();
  const [owner] = await deps.db
    .select({ email: user.email })
    .from(user)
    .where(and(eq(user.orgId, message.orgId), eq(user.id, message.payload.userId)));
  if (!owner) return await delivery.ack();
  const anchors = await deps.db
    .select({
      stream: auditAnchor.stream,
      seq: auditAnchor.chainSeq,
      hash: auditAnchor.hash,
      name: device.name,
    })
    .from(auditAnchor)
    .leftJoin(
      device,
      and(eq(device.orgId, auditAnchor.orgId), sql`${device.id}::text = ${auditAnchor.stream}`),
    )
    .where(and(eq(auditAnchor.orgId, message.orgId), eq(auditAnchor.day, message.payload.day)))
    .orderBy(asc(auditAnchor.stream));
  const day = formatDay(message.payload.day);
  const link = `${deps.baseUrl.replace(/\/$/, "")}/audit/integrity`;
  const plain = [
    `The audit chains of ${day} closed with these heads. Keep this email: if a chain is ever edited, its head will`,
    `no longer match.`,
    "",
    ...anchors.map(
      (a) => `${a.stream === "org" ? "Back office" : (a.name ?? a.stream)} #${a.seq} ${a.hash}`,
    ),
    "",
    `Verify the chains: ${link}`,
  ].join("\n");
  await deps.mail({
    email: owner.email,
    subject: `Shopper audit anchor for ${day}`,
    link,
    plain,
    attachments: [],
  });
  await delivery.ack();
}

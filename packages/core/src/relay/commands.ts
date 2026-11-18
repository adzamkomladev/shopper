import { eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { org, relayBox } from "@shopper/db-pg";
import type { Licence } from "../licence";
import { ManagementError } from "../management";
import { provisionOrg } from "../provisioning";

/**
 * Shopper staff enrol an on-prem box with its relay org: the org named by its licence, created in relay mode on first
 * enrolment. A shop that already trades in the cloud never becomes a relay. Enrolling again sets the add-on flag and
 * leaves a revocation in place. The platform org's chain records it.
 */
export const enrolRelay = defineCommand({
  name: "platform.relay.enrol",
  async run(
    tx,
    context,
    input: {
      licence: Licence;
      onlineOrders: boolean;
      metadata: { schemaVersion: number; syncProtocol: number; archiveFormat: number };
    },
  ) {
    const licence = input.licence;
    const [existing] = await tx
      .select({ mode: org.mode })
      .from(org)
      .where(eq(org.id, licence.org))
      .for("update");
    if (existing && existing.mode !== "relay")
      throw new ManagementError(
        "This shop already runs in the cloud, so it cannot be a relay.",
        409,
      );
    if (!existing)
      await provisionOrg(
        tx,
        { orgId: licence.org, appVersion: context.appVersion },
        { name: licence.site, mode: "relay", metadata: input.metadata },
      );
    const [row] = await tx
      .insert(relayBox)
      .values({
        orgId: licence.org,
        licenceId: licence.id,
        machine: licence.machine,
        onlineOrders: input.onlineOrders,
      })
      .onConflictDoUpdate({
        target: relayBox.licenceId,
        set: { onlineOrders: input.onlineOrders, updatedAt: sql`now()` },
      })
      .returning();
    return row!;
  },
  audit: (_input, row) => ({
    orgId: row.orgId,
    licenceId: row.licenceId,
    machine: row.machine,
    onlineOrders: row.onlineOrders,
  }),
});

/** Switches the Online Orders add-on for an enrolled box. */
export const setRelayOnlineOrders = defineCommand({
  name: "platform.relay.online_orders",
  async run(tx, _context, input: { licenceId: string; onlineOrders: boolean }) {
    const [row] = await tx
      .update(relayBox)
      .set({ onlineOrders: input.onlineOrders, updatedAt: sql`now()` })
      .where(eq(relayBox.licenceId, input.licenceId))
      .returning();
    if (!row) throw new ManagementError("No box is enrolled with that licence", 404);
    return row;
  },
  audit: (_input, row) => ({
    orgId: row.orgId,
    licenceId: row.licenceId,
    onlineOrders: row.onlineOrders,
  }),
});

/** Revokes a licence for the relay for good (a stolen or replaced box); revoking again keeps the first time. */
export const revokeRelay = defineCommand({
  name: "platform.relay.revoke",
  async run(tx, _context, input: { licenceId: string }) {
    const [row] = await tx
      .update(relayBox)
      .set({ revokedAt: sql`coalesce(${relayBox.revokedAt}, now())`, updatedAt: sql`now()` })
      .where(eq(relayBox.licenceId, input.licenceId))
      .returning();
    if (!row) throw new ManagementError("No box is enrolled with that licence", 404);
    return row;
  },
  audit: (_input, row) => ({
    orgId: row.orgId,
    licenceId: row.licenceId,
    revokedAt: row.revokedAt!.toISOString(),
  }),
});

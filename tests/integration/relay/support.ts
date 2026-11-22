// A cloud that issues licences and a way to make boxes and send their licence-signed relay requests. Importing it
// registers the auth world (two shops; the second stands in for the platform org).
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import { generateKey, issueLicence, signedRequest, type Licence } from "@shopper/core/licence";
import { enrolRelay } from "@shopper/core/relay";
import { buildInfo } from "@shopper/config";
import { context, db, otherContext } from "../auth/setup";

export const CLOUD = "https://cloud.shopper.test";
export type Box = { licence: Licence; key: string };

export async function relayCloud(options: Partial<Parameters<typeof createApi>[0]> = {}) {
  const issuer = await generateKey();
  const api = createApi({ database: db, licenceSigningKey: issuer.privateKey, ...options });
  return {
    issuer,
    api,
    /** A box with its own key and a licence for a new org (or the fields given), signed by `signer`. */
    async box(fields: Partial<Licence> = {}, signer = issuer.privateKey): Promise<Box> {
      const key = await generateKey();
      const licence = await issueLicence(signer, {
        id: v7(),
        org: v7(),
        site: "Osu Mart",
        machine: "a".repeat(64),
        key: key.publicKey,
        terminals: 5,
        issuedAt: new Date().toISOString(),
        maintenanceUntil: "2099-12-31",
        ...fields,
      });
      return { licence, key: key.privateKey };
    },
    /** The box's licence-signed request, not yet sent. */
    signed: (box: Box, path: string, init: { method: string; body?: string } = { method: "GET" }) =>
      signedRequest(box, `${CLOUD}${path}`, init),
    /** The box's licence-signed request to the relay. */
    async send(
      box: Box,
      path: string,
      init: { method: string; body?: string } = { method: "GET" },
      now?: Date,
    ) {
      return api.fetch(await signedRequest(box, `${CLOUD}${path}`, init, now));
    },
  };
}

/** Platform staff enrol the box with its relay org (created with the licence's org id). */
export const enrol = (box: Box, onlineOrders = true) =>
  enrolRelay(
    db,
    { orgId: otherContext.orgId, appVersion: context.appVersion },
    {
      licence: box.licence,
      onlineOrders,
      metadata: buildInfo,
    },
  );

export const relayRow = async (box: Box) =>
  (await db.select().from(schema.relayBox).where(eq(schema.relayBox.licenceId, box.licence.id)))[0];

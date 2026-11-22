// A box with real till sales and points (the golden till database) and its relay org on a second database, for the
// customer copy (v1.5 Day 51). The relay org has the box's org id, is in relay mode and enrols the box's licence.
//   const w = await customersWorld()
//   w.box / w.ctx           -> the box database (golden org) and a command context for its staff
//   w.relayDb / w.shop      -> the relay database and the relay org's shop ({ slug }) for shopHttp sign-in
//   w.run(lose?)            -> one Publisher run on the box; w.sent holds every relay request it made
//   w.share(id, on)         -> staff switch a box customer's online receipts and points
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import { buildInfo } from "@shopper/config";
import { setCustomerOnline } from "@shopper/core/customers";
import { generateKey, issueLicence, signedRequest } from "@shopper/core/licence";
import { enrolRelay, publishPending } from "@shopper/core/relay";
import { ids } from "../../fixtures/sales/golden";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { emptyDatabase } from "../migration/archive";
import { databases } from "../till/server";

export async function customersWorld() {
  const relay = await emptyDatabase();
  const relayDb = relay.db;
  const slug = `relay-${Date.now().toString(36)}`;
  await provisionOrg(relayDb, provisioningContext(ids.org), { name: "Osu Mart", slug });
  await relayDb.update(schema.org).set({ mode: "relay" }).where(eq(schema.org.id, ids.org));
  const platform = provisioningContext();
  await provisionOrg(relayDb, platform, { name: "Platform", slug: `${slug}-platform` });
  const issuer = await generateKey();
  const key = await generateKey();
  const licence = await issueLicence(issuer.privateKey, {
    id: v7(),
    org: ids.org,
    site: "Osu Mart",
    machine: "c".repeat(64),
    key: key.publicKey,
    terminals: 5,
    issuedAt: new Date().toISOString(),
    maintenanceUntil: "2099-12-31",
  });
  await enrolRelay(
    relayDb,
    { orgId: platform.orgId, appVersion: "test" },
    { licence, onlineOrders: true, metadata: buildInfo },
  );
  const api = createApi({ database: relayDb, licenceSigningKey: issuer.privateKey });
  const box = databases().db;
  const ctx = { ...databases().context, orgId: ids.org, role: "admin", actorId: ids.cashier };
  await box.update(schema.org).set({ onlineOrders: true }).where(eq(schema.org.id, ids.org));
  const sent: { path: string; body: string }[] = [];
  /** One run; the relay's answer to `lose` is dropped after the relay acted on it (a lost acknowledgement). */
  const run = (lose?: string) =>
    publishPending(box, ctx, {
      send: async (path, init) => {
        sent.push({ path, body: init.body ?? "" });
        const answer = await api.fetch(
          await signedRequest({ licence, key: key.privateKey }, `https://cloud.test${path}`, init),
        );
        return path.split("?")[0] === lose ? new Response("", { status: 503 }) : answer;
      },
    });
  const send = async (path: string, body: unknown) =>
    api.fetch(
      await signedRequest({ licence, key: key.privateKey }, `https://cloud.test${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  return {
    box,
    ctx,
    relayDb,
    shop: { slug },
    sent,
    run,
    send,
    share: (id: string, on: boolean) => setCustomerOnline(box, ctx, { id, on }),
    close: () => relay.close(),
  };
}

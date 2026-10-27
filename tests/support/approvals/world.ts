// A golden world with a live till session, the org owner in the back office, and an API whose approval workflow
// runs in process and records every envelope it pushes to a store.
import { eq } from "drizzle-orm";
import { boxApprovals } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import * as schema from "@shopper/db-pg";
import type { Envelope } from "@shopper/ports";
import { ids } from "../../fixtures/sales/golden";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { goldenWorld } from "../sales/golden/setup";
import { runGolden } from "../sales/golden/run";
import { refundEvent } from "../sales/refunds";
import { portalOwner } from "../api/portal";
import { notifications } from "../stock/queue";
import { deviceToken, devices } from "../till/server";

export async function approvalWorld() {
  const world = await goldenWorld({
    since: new Date(Date.now() - 3_600_000).toISOString(),
    until: new Date(Date.now() + 3 * 3_600_000).toISOString(),
  });
  const owner = await portalOwner(ids.org, ids.cashier);
  const pushed: Envelope[] = [];
  const realtime = {
    publish: async (_orgId: string, _storeId: string, message: Envelope) => {
      pushed.push(message);
    },
    subscribe: async () => ({ close: async () => {} }),
  };
  /** An API whose approvals expire after `timeoutMs` when given, else after the real 10 minutes. */
  const apiWith = (timeoutMs?: number) =>
    createApi({
      database: world.db,
      devices,
      authentication: owner.auth,
      notifications,
      realtime,
      approvals: boxApprovals({
        withDatabase: (run) => run(world.db),
        realtime,
        appVersion: "test",
        timeoutMs,
      }),
    });
  const api = apiWith();

  /** The register asks for an approval. */
  async function ask(body: object, using = api) {
    const response = await using.request("/approvals", {
      method: "POST",
      headers: {
        authorization: `Bearer ${world.session.proof}`,
        "x-shopper-device-token": deviceToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  }
  /** A back-office member answers it; the response status. */
  const decide = async (cookie: string, id: string, body: object) =>
    (
      await api.request(`/approvals/${id}/decision`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    ).status;
  const approval = async (id: string) =>
    (
      await world.db.select().from(schema.approvalRequest).where(eq(schema.approvalRequest.id, id))
    )[0]!;
  /** A card sale rung up now and the refund of its one line, as the register would send it. */
  async function refundable() {
    const sale = (await runGolden(
      world,
      tradingDay.find((s) => s.name === "manual card")!,
      new Date(),
    ))!;
    const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }]);
    event.refund.deviceTime = new Date().toISOString();
    return { sale, event };
  }
  return { world, owner, api, apiWith, pushed, ask, decide, approval, refundable };
}

import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { cashierSession } from "@shopper/db-pg";
import { offlineWithheld } from "@shopper/core/schemas";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { shiftEvent } from "../../../support/sales/shifts";
import { syncHeaders } from "../../../support/till/requests";
import { api } from "../../../support/till/server";

// The server session ends at noon; the cashier signs in offline at 12:30 and closes the shift at 20:00
// without another sale, so the Z is the first upload under the offline session.
let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld({ until: "2026-10-15T12:00:00.000Z" });
});
afterAll(async () => {
  await world?.local.close();
});

function offlineClose() {
  const id = v7();
  return {
    id,
    proof: `${world.session.proof}.${id}`,
    offline: {
      parentSessionId: world.session.id,
      issuedAt: "2026-10-15T12:30:00.000Z",
      expiresAt: "2026-10-15T20:30:00.000Z",
      permissions: world.session.permissions.filter((code) => !offlineWithheld.includes(code)),
    },
    event: shiftEvent(world, { actor: { userId: world.session.userId, sessionId: id } }),
  };
}

const post = async (body: Record<string, unknown>) =>
  (await (
    await api.request("/sync/shifts", {
      method: "POST",
      headers: syncHeaders(),
      body: JSON.stringify({ requestId: v7(), ...body }),
    })
  ).json()) as Record<string, any>;

test("a Z closed under an offline session with no sale after it adopts the session and is accepted", async () => {
  const close = offlineClose();
  const body = await post({ proof: close.proof, offline: close.offline, shift: close.event });
  expect(body.rejected).toBeUndefined();
  expect(body.accepted).toMatchObject({ id: close.event.shift.report.shiftId });
  const [row] = await world.db.select().from(cashierSession).where(eq(cashierSession.id, close.id));
  expect(row).toMatchObject({ parentSessionId: world.session.id, userId: world.session.userId });
});

test("the same Z without the offline descriptor is refused: the server has never seen the session", async () => {
  const close = offlineClose();
  const body = await post({ proof: close.proof, shift: close.event });
  expect(body.rejected).toMatchObject({ code: "INVALID_SESSION" });
});

// A running till host whose register knows one manager (PIN from ../approvers) and holds a one-line basket.
import { v7 } from "uuid";
import { hashPin } from "@shopper/auth/devices";
import { refreshApprovers } from "@shopper/core/till";
import { pin } from "../approvers";
import { createHostFixture } from "./fixture";

export const manager = v7();

export async function startWithManager() {
  const fixture = await createHostFixture({ freshSession: true });
  const { identity } = fixture.config;
  await refreshApprovers(
    fixture.database,
    { orgId: identity.orgId, deviceId: identity.deviceId, appVersion: "0.0.0-test" },
    {
      approvers: [
        {
          userId: manager,
          name: "Esi Manager",
          pinHash: await hashPin(pin),
          permissions: ["sale.price_override", "sale.void"],
        },
      ],
      at: new Date(),
    },
  );
  const host = await fixture.start();
  const added = await host.request({
    type: "add",
    expectedRevision: 0,
    productId: fixture.config.references.products[0].id,
  });
  const line = (added as { view: { draft: { lines: { id: string }[] } } }).view.draft.lines[0]!;
  return { fixture, host, lineId: line.id };
}

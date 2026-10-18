// The customer display is a second bridge client: it only listens, so the host must push every
// basket change and the completed sale to all authorized clients.
import { afterEach, expect, it } from "vite-plus/test";
import * as v from "valibot";
import { bridgeMessage } from "@shopper/sync/bridge";
import { startRegister, type Register } from "../../../../support/hardware/host";
import { connectBrowser } from "../../../../support/till/host/socket";

let register: Register | undefined;
afterEach(async () => register?.close());

/** Every unsolicited message of one type the client receives, parsed as the browser parses it. */
async function listen(ready: Register["host"]["ready"], type: string) {
  const client = await connectBrowser(ready);
  const seen: Record<string, any>[] = [];
  client.socket.on("message", (data: Buffer) => {
    const message = JSON.parse(data.toString());
    if (message.type !== type) return;
    expect(v.safeParse(bridgeMessage, message).success).toBe(true);
    seen.push(message);
  });
  return seen;
}

it("every basket change broadcasts the draft to all bridge clients", async () => {
  register = await startRegister();
  const first = await listen(register.host.ready, "draft");
  const second = await listen(register.host.ready, "draft");
  const productId = register.fixture.config.references.products[0].id;

  const added = await register.ask({ type: "add", expectedRevision: 0, productId });
  const lineId: string = added.view.draft.lines[0].id;
  await register.ask({
    type: "setQuantity",
    expectedRevision: 1,
    lineId,
    quantityThousandths: 2_000,
  });
  await register.ask({ type: "removeLine", expectedRevision: 2, lineId });

  await expect.poll(() => first.length).toBe(3);
  await expect.poll(() => second.length).toBe(3);
  expect(second.map((message) => message.view.draft.revision)).toEqual([1, 2, 3]);
  expect(second[1].view.draft.lines[0].quantityThousandths).toBe(2_000);
  expect(second[2].view.draft.lines).toEqual([]);
});

it("a completed sale broadcasts its total and change due to all bridge clients", async () => {
  register = await startRegister();
  const sold = await listen(register.host.ready, "sold");
  const { receipt } = await register.sell([{ kind: "cash", amount: 500_000 }]);

  await expect.poll(() => sold.length).toBe(1);
  expect(sold[0]).toEqual({ type: "sold", total: receipt.total, change: receipt.change });
  expect(receipt.change).toBeGreaterThan(0);
});

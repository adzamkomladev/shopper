// Day 30 S2: the `shop.otp` message carries only the login and send; the consumer derives the code and texts it.
//   deliverNotification(deps, delivery) -> one Arkesel send to 233…, acked; a stale send texts nothing
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { deliverNotification } from "@shopper/core/notifications";
import { createShopAccess, loginCode } from "@shopper/core/shop";
import { arkesel, recordedDelivery, sms } from "../../support/stock/sms";
import { linkSecret, shopWorld } from "../../support/shop/world";

let world: Awaited<ReturnType<typeof shopWorld>>;
let access: ReturnType<typeof createShopAccess>;
let deps: Parameters<typeof deliverNotification>[0];

beforeAll(async () => {
  world = await shopWorld();
  access = createShopAccess({
    database: world.db,
    linkSecret,
    appVersion: "test",
    queue: world.queue,
  });
  deps = { db: world.db, appVersion: "test", sms, linkSecret };
});
afterAll(async () => world?.close());

const textsTo = (phone: string) => arkesel.requests.filter((r) => r.recipients.includes(phone));

test("the code reaches the phone, named for the shop, and a redelivery texts the same code", async () => {
  const { loginId } = await access.start(world.a.orgId, "0244100200");
  const message = world.sent.at(-1)!;
  const first = recordedDelivery(message);
  await deliverNotification(deps, first.delivery);
  expect(first.settled).toEqual(["ack"]);
  const code = await loginCode(linkSecret, loginId, 1);
  expect(textsTo("233244100200")).toEqual([
    {
      sender: "Shopper",
      recipients: ["233244100200"],
      message: `${code} is your ${world.a.slug} Mart sign-in code. It expires in 10 minutes. Never share it.`,
    },
  ]);
  const again = recordedDelivery(message, 2);
  await deliverNotification(deps, again.delivery);
  expect(textsTo("233244100200").map((r) => r.message.slice(0, 6))).toEqual([code, code]);
});

test("a superseded, used or locked login texts nothing and acks", async () => {
  const { loginId } = await access.start(world.a.orgId, "0244100300");
  const firstSend = world.sent.at(-1)!;
  await access.resend(world.a.orgId, loginId);
  const stale = recordedDelivery(firstSend);
  await deliverNotification(deps, stale.delivery);
  expect(stale.settled).toEqual(["ack"]);
  expect(textsTo("233244100300")).toEqual([]);

  await access.verify(world.a.orgId, loginId, await loginCode(linkSecret, loginId, 2));
  const used = recordedDelivery(world.sent.at(-1)!);
  await deliverNotification(deps, used.delivery);
  expect(used.settled).toEqual(["ack"]);
  expect(textsTo("233244100300")).toEqual([]);
});

test("without an SMS channel or when Arkesel fails, the message retries", async () => {
  await access.start(world.b.orgId, "0244100400");
  const message = world.sent.at(-1)!;
  const unconfigured = recordedDelivery(message);
  await deliverNotification({ ...deps, sms: undefined }, unconfigured.delivery);
  expect(unconfigured.settled).toEqual(["retry"]);

  arkesel.failNext(1);
  const failing = recordedDelivery(message);
  await deliverNotification(deps, failing.delivery);
  expect(failing.settled).toEqual(["retry"]);
  expect(textsTo("233244100400")).toEqual([]);
});

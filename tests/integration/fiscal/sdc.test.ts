// The SDC client against the fake that speaks its contract: a signature, a final rejection, and an SDC that is down or
// failing, which must surface as SdcUnavailable so the lane retries rather than mark the document rejected.
import { afterAll, beforeEach, expect, test } from "vite-plus/test";
import { createSdc } from "@shopper/core/fiscal";
import { SdcUnavailable } from "@shopper/ports";
import { startSdcFake } from "../../../tooling/sdc/server";

const fake = await startSdcFake();
const sdc = createSdc({ url: fake.url, apiKey: fake.apiKey });
const payload = { type: "invoice", totals: { total: 125_000 } };
beforeEach(() => fake.reset());
afterAll(() => fake.stop());

test("an accepted invoice comes back signed with a QR, and a resubmission gets the same signature", async () => {
  const first = await sdc.submit({ invoiceNumber: "A1-000001", payload });
  expect(first).toMatchObject({ status: "accepted", sdcId: fake.sdcId, counter: 1 });
  expect(first.status === "accepted" && first.qr).toContain(
    first.status === "accepted" ? first.signature : "x",
  );
  const again = await sdc.submit({ invoiceNumber: "A1-000001", payload });
  expect(again).toEqual(first);
  expect(await sdc.submit({ invoiceNumber: "A1-000002", payload })).toMatchObject({ counter: 2 });
  expect(fake.arrivals.map((a) => a.invoiceNumber)).toEqual([
    "A1-000001",
    "A1-000001",
    "A1-000002",
  ]);
  expect(fake.arrivals[0]!.payload).toEqual(payload);
});

test("a rejection is returned as final with the SDC's code and message", async () => {
  fake.reject("A1-000003", "E_TIN", "Buyer TIN is not registered");
  expect(await sdc.submit({ invoiceNumber: "A1-000003", payload })).toEqual({
    status: "rejected",
    code: "E_TIN",
    message: "Buyer TIN is not registered",
  });
});

test("an unreachable SDC and a 503 both throw SdcUnavailable", async () => {
  fake.down();
  await expect(sdc.submit({ invoiceNumber: "A1-000004", payload })).rejects.toBeInstanceOf(
    SdcUnavailable,
  );
  expect(fake.arrivals).toHaveLength(0);
  fake.up();
  fake.failNext(1);
  await expect(sdc.submit({ invoiceNumber: "A1-000004", payload })).rejects.toBeInstanceOf(
    SdcUnavailable,
  );
  expect(await sdc.submit({ invoiceNumber: "A1-000004", payload })).toMatchObject({
    status: "accepted",
  });
});

test("a wrong API key is the SDC being unavailable, never a rejection", async () => {
  const wrong = createSdc({ url: fake.url, apiKey: "nope" });
  await expect(wrong.submit({ invoiceNumber: "A1-000005", payload })).rejects.toBeInstanceOf(
    SdcUnavailable,
  );
});

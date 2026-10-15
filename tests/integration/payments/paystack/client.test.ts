import { createPaystack, PaystackError } from "@shopper/core/payments/paystack";
import { fromDecimal, money } from "@shopper/money";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { startPaystackFake } from "../../../../tooling/paystack/server";

const PHONES = {
  success: "0551234987",
  otp: "0551234986",
  failed: "0551234985",
  pending: "0241234567",
};
let fake: Awaited<ReturnType<typeof startPaystackFake>>;
let paystack: ReturnType<typeof createPaystack>;

beforeAll(async () => {
  fake = await startPaystackFake();
  fake.behave(PHONES.success, "success");
  fake.behave(PHONES.otp, "send_otp");
  fake.behave(PHONES.pending, "pending");
  paystack = createPaystack({ secretKey: fake.secretKey, baseUrl: fake.baseUrl });
});
afterAll(() => fake.stop());

const charge = (reference: string, phone: string, amount = "12.50") => ({
  reference,
  phone,
  amount: fromDecimal(amount),
  network: "telecel" as const,
  email: "till@shopper.test",
});

describe("Paystack mobile money client against the fake", () => {
  test("a charge on a approving number is confirmed and sent in pesewas with the vod provider", async () => {
    const result = await paystack.charge(charge("ref-success", PHONES.success));
    expect(result).toMatchObject({ status: "confirmed", providerReference: "ref-success" });
    expect(fake.requests.filter((r) => r.path === "/charge").at(-1)?.body).toEqual({
      email: "till@shopper.test",
      amount: 1250,
      currency: "GHS",
      reference: "ref-success",
      mobile_money: { phone: PHONES.success, provider: "vod" },
    });
  });

  test("airteltigo and mtn map to atl and mtn", async () => {
    await paystack.charge({ ...charge("ref-atl", PHONES.success), network: "airteltigo" });
    await paystack.charge({ ...charge("ref-mtn", PHONES.success), network: "mtn" });
    const providers = fake.requests
      .filter((r) => r.path === "/charge")
      .slice(-2)
      .map((r) => (r.body as { mobile_money: { provider: string } }).mobile_money.provider);
    expect(providers).toEqual(["atl", "mtn"]);
  });

  test("the OTP path asks for a code, rejects a wrong one, then confirms", async () => {
    expect(await paystack.charge(charge("ref-otp", PHONES.otp))).toMatchObject({ status: "otp" });
    expect(await paystack.submitOtp({ reference: "ref-otp", otp: "000000" })).toMatchObject({
      status: "otp",
      message: expect.stringContaining("incorrect"),
    });
    expect(await paystack.submitOtp({ reference: "ref-otp", otp: "123456" })).toMatchObject({
      status: "confirmed",
    });
    expect(await paystack.verify("ref-otp")).toMatchObject({ status: "confirmed" });
  });

  test("a declined number is failed with Paystack's reason", async () => {
    const result = await paystack.charge(charge("ref-failed", PHONES.failed));
    expect(result).toMatchObject({
      status: "failed",
      message: expect.stringContaining("Declined"),
    });
    expect(await paystack.verify("ref-failed")).toMatchObject({ status: "failed" });
  });

  test("a charge awaiting the customer stays pending until it settles", async () => {
    expect(await paystack.charge(charge("ref-pending", PHONES.pending))).toMatchObject({
      status: "pending",
    });
    expect(await paystack.verify("ref-pending")).toMatchObject({ status: "pending" });
    fake.settle("ref-pending", "success");
    expect(await paystack.verify("ref-pending")).toMatchObject({ status: "confirmed" });
  });

  test("an amount that is not whole pesewas is refused before any request is made", async () => {
    const before = fake.requests.length;
    await expect(paystack.charge(charge("ref-frac", PHONES.success, "12.505"))).rejects.toThrow(
      /whole pesewas/,
    );
    expect(money(fromDecimal("12.505")) % 100).not.toBe(0);
    expect(fake.requests).toHaveLength(before);
  });

  test("a wrong secret key raises a PaystackError with the 401 status", async () => {
    const bad = createPaystack({ secretKey: "sk_test_wrong", baseUrl: fake.baseUrl });
    await expect(bad.charge(charge("ref-auth", PHONES.success))).rejects.toMatchObject({
      name: "PaystackError",
      httpStatus: 401,
      code: "invalid_Key",
    });
    await expect(bad.verify("ref-success")).rejects.toBeInstanceOf(PaystackError);
  });
});

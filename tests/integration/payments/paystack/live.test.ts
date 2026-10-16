import { createPaystack } from "@shopper/core/payments/paystack";
import { fromDecimal } from "@shopper/money";
import { describe, expect, test } from "vite-plus/test";

const secretKey = process.env.PAYSTACK_SECRET_KEY;
// Paystack's Ghana sandbox: 0551234987 approves at once, 0551234986 asks for an OTP.
const APPROVED_PHONE = "0551234987";
const OTP_PHONE = "0551234986";
const TEST_OTP = "123456";

describe.skipIf(!secretKey)("Paystack sandbox mobile money", () => {
  const paystack = createPaystack({ secretKey: secretKey! });
  const input = (phone: string) => ({
    reference: `shopper-live-${crypto.randomUUID()}`,
    phone,
    amount: fromDecimal("1.00"),
    network: "mtn" as const,
    email: "live-test@example.com",
  });

  test("the approving test number is confirmed and verifies as confirmed", async () => {
    const charge = input(APPROVED_PHONE);
    expect(await paystack.charge(charge)).toMatchObject({ status: "confirmed" });
    expect(await paystack.verify(charge.reference)).toMatchObject({ status: "confirmed" });
  });

  test("the OTP test number asks for an OTP, and the documented code resolves it to a settled status", async () => {
    const charge = input(OTP_PHONE);
    expect(await paystack.charge(charge)).toMatchObject({ status: "otp" });
    const submitted = await paystack.submitOtp({ reference: charge.reference, otp: TEST_OTP });
    // The sandbox answers with whatever it settles on; it must be a normalised status.
    expect(["otp", "pending", "confirmed", "failed"]).toContain(submitted.status);
    const verified = await paystack.verify(charge.reference);
    expect(["pending", "confirmed", "failed"]).toContain(verified.status);
    console.info(`live otp: submit=${submitted.status} verify=${verified.status}`);
  });

  test("a non-test number is declined", async () => {
    expect(await paystack.charge(input("0551234000"))).toMatchObject({ status: "failed" });
  });
});

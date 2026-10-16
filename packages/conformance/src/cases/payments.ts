import assert from "node:assert/strict";
import type { MomoFixture } from "./types";

export function momoConformance(
  name: string,
  test: (name: string, run: () => Promise<void>) => unknown,
  fixture: () => Promise<MomoFixture>,
) {
  for (const [phone, status] of [
    ["0551234987", "confirmed"],
    ["0551234985", "failed"],
    ["0241234567", "expired"],
  ] as const)
    test(`${name}: MoMo ${status} is durable and uses its reference as business key`, async () => {
      const f = await fixture();
      try {
        const reference = await f.start(phone);
        await waitFor(f, reference, status);
        assert.deepEqual(await f.run(reference), { businessKey: reference, status: "completed" });
      } finally {
        await f.close();
      }
    });
  test(`${name}: MoMo accepts another OTP after an incorrect attempt`, async () => {
    const f = await fixture();
    try {
      const reference = await f.start("0551234986");
      await waitFor(f, reference, "otp");
      await f.otp(reference, "000000");
      await f.otp(reference, "123456");
      await waitFor(f, reference, "confirmed");
      assert.deepEqual(await f.run(reference), { businessKey: reference, status: "completed" });
    } finally {
      await f.close();
    }
  });
  test(`${name}: provider exceptions expire uncertain money and terminate the run`, async () => {
    const f = await fixture();
    try {
      const reference = await f.start("0551234984");
      await waitFor(f, reference, "expired");
      assert.deepEqual(await f.run(reference), { businessKey: reference, status: "failed" });
    } finally {
      await f.close();
    }
  });
  test(`${name}: lost-reply retries preserve full normalized phone identity and charge once`, async () => {
    const f = await fixture();
    try {
      const reference = await f.start("0241234567");
      assert.equal(await f.retry(reference, "+233241234567"), true);
      assert.equal(await f.retry(reference, "0541234567"), false);
      assert.equal(await f.retry(reference, "0241234567"), true);
      await waitFor(f, reference, "expired");
      assert.equal(await f.chargeCount(reference), 1);
    } finally {
      await f.close();
    }
  });
}

async function waitFor(f: MomoFixture, reference: string, status: string) {
  for (let waited = 0; waited < 10000; waited += 25) {
    if ((await f.status(reference)) === status) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(await f.status(reference), status);
}

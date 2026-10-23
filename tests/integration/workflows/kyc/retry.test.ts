// A text that fails is retried by the workflow: the checkpointed issue step replays as sent, so the code goes out.
import { expect, test } from "vite-plus/test";
import { arkesel, as, caseRow, openCredit, otpFor, smsCount } from "../../../support/kyc/world";

test("an SMS that fails once is sent on the step's retry, as the same first send", async () => {
  arkesel.failNext(1);
  const made = await openCredit();
  const code = await otpFor(made.phone);
  expect(smsCount(made.phone)).toBe(1);
  expect(await caseRow(made.id)).toMatchObject({ otpSends: 1, otpAttempts: 0 });
  expect((await as("accountant").verify(made.id, code)).status).toBe(200);
});

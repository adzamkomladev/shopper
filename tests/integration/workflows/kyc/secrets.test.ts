// Neither the full ID number nor any OTP is stored or logged anywhere: audit, workflow steps and runs, the case row, API replies, logs.
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import {
  as,
  openCredit,
  otpFor,
  storedText,
  waitForRun,
  wrongCodeFor,
} from "../../../support/kyc/world";

const idNumber = "GHA-918273645-7";
const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
  vi.spyOn(console, level),
);
beforeAll(() => spies.forEach((spy) => spy.mockClear()));
afterAll(() => spies.forEach((spy) => spy.mockRestore()));

test("the ID number and every OTP appear in no audit row, workflow step or run, case column, reply or log", async () => {
  const made = await openCredit();
  const first = await otpFor(made.phone);
  await as("accountant").verify(made.id, wrongCodeFor(first));
  expect((await as("accountant").resend(made.id)).status).toBe(200);
  const second = await otpFor(made.phone, 2);
  const replies = [
    await as("accountant").verify(made.id, second),
    await as("accountant").recordId(made.id, {
      idType: "ghana_card",
      idNumber,
      fullName: "Kofi Credit",
    }),
    await as("admin").decide(made.id, {
      approve: true,
      limit: 5_000_000,
      idSighted: true,
      note: "Card checked",
    }),
    await as("admin").read(made.id),
    await as("admin").list(),
  ];
  for (const reply of replies) expect(reply.status).toBe(200);
  await waitForRun(made.id, "completed");

  const stores: Record<string, string> = {
    ...(await storedText()),
    "API replies": replies.map((reply) => reply.text).join("\n"),
    "console output": spies
      .flatMap((spy) => spy.mock.calls)
      .map((args) =>
        args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "),
      )
      .join("\n"),
  };
  // Not vacuous: the stores do hold this case's rows.
  expect(stores.audit_log).toContain("kyc.id.record");
  expect(stores.workflow_run).toContain(made.id);
  expect(stores.kyc_case).toContain("GHA-");

  const leaks: string[] = [];
  const digitsOnly = idNumber.replace(/\D/g, "").slice(0, 9);
  for (const [store, text] of Object.entries(stores)) {
    if (text.includes(idNumber)) leaks.push(`${store}: full ID number`);
    if (text.includes(digitsOnly)) leaks.push(`${store}: ID digits`);
    for (const code of [first, second])
      if (new RegExp(`(?<![0-9a-f])${code}(?![0-9a-f])`).test(text))
        leaks.push(`${store}: OTP ${code === first ? "1" : "2"}`);
  }
  expect(leaks).toEqual([]);
});

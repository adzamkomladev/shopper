// The X and Z printouts: encodeShiftReport(report, { profile, paperMm, names? }) -> ESC/POS bytes. The Z prints the
// tender table (expected, declared, variance), the counted denominations, the movements, the cashiers, the approver
// and last the audit anchor with its hash in groups of 16. The X says it closes nothing and has no anchor.
import { expect, test } from "vite-plus/test";
import { encodeShiftReport, encodeTestPage, printerProfiles } from "@shopper/hardware";
import type { ZReport } from "@shopper/core/schemas";
import { decodeEscPos } from "../../support/hardware/escpos";

const id = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const hash = "0123456789abcdef".repeat(4);
const x = {
  kind: "x" as const,
  shiftId: id(1),
  storeId: id(2),
  branchId: id(3),
  deviceId: id(4),
  registerName: "Front till",
  openedAt: "2026-10-19T08:00:00.000Z",
  openedBy: id(5),
  at: "2026-10-19T17:30:00.000Z",
  sales: { count: 3, gross: 73_000, tax: 12_101 },
  refunds: { count: 2, total: 25_000 },
  tenders: [
    { tender: "cash" as const, sales: 49_000, refunds: 13_000, expected: 1_036_000 },
    { tender: "card" as const, sales: 24_000, refunds: 12_000, expected: 12_000 },
    { tender: "momo" as const, sales: 0, refunds: 0, expected: 0 },
  ],
  cash: { float: 2_000_000, sales: 49_000, refunds: 13_000, drops: 1_000_000, expected: 1_036_000 },
  movements: [
    {
      kind: "drop" as const,
      amount: 1_000_000,
      reason: "Safe run",
      actorId: id(5),
      at: "2026-10-19T11:00:00.000Z",
    },
    {
      kind: "no_sale" as const,
      amount: 0,
      reason: "Change request",
      actorId: id(5),
      at: "2026-10-19T11:30:00.000Z",
    },
  ],
  cashiers: [
    { userId: id(5), name: "Ama Mensah" },
    { userId: id(6), name: null },
  ],
};
const z: ZReport = {
  ...x,
  kind: "z",
  declared: {
    counts: { "1000000": 1, "20000": 1, "10000": 1, "5000": 1, "1000": 3 },
    cash: 1_038_000,
    card: 22_000,
    momo: 0,
  },
  variances: [
    { tender: "cash", expected: 1_036_000, declared: 1_038_000, variance: 2_000 },
    { tender: "card", expected: 12_000, declared: 22_000, variance: 10_000 },
    { tender: "momo", expected: 0, declared: 0, variance: 0 },
  ],
  threshold: 5_000,
  approverId: id(7),
  closedAt: "2026-10-19T17:30:00.000Z",
  closedBy: id(5),
  anchor: { seq: 42, hash },
};
const options = { profile: printerProfiles.epson, paperMm: 80 as const };
const lines = (bytes: Uint8Array) => decodeEscPos(bytes).text.map((line) => line.trimEnd());

test("the Z prints the tender table, the counted denominations, the movements, the approver and the anchor", () => {
  const text = lines(encodeShiftReport(z, { ...options, names: { [id(7)]: "Kofi Boateng" } }));
  const all = text.join("\n");
  expect(all).toContain("Z REPORT");
  expect(all).toContain("Front till");
  expect(all).not.toContain("not a close");
  expect(text).toContainEqual(expect.stringMatching(/^Cash\s+103\.60\s+103\.80\s+\+0\.20$/));
  expect(text).toContainEqual(expect.stringMatching(/^Card\s+1\.20\s+2\.20\s+\+1\.00$/));
  expect(text).toContainEqual(expect.stringMatching(/^MoMo\s+0\.00\s+0\.00\s+0\.00$/));
  expect(text).toContainEqual(expect.stringMatching(/^GHS 100\.00 x 1\s+GHS 100\.00$/));
  expect(text).toContainEqual(expect.stringMatching(/^GHS 0\.10 x 3\s+GHS 0\.30$/));
  expect(all).toContain("Safe run");
  expect(all).toContain("Change request");
  expect(all).toContain("Ama Mensah");
  expect(all).toContain("Approved by Kofi Boateng");
  expect(text).toContain("Audit anchor #42");
  expect(text.slice(-4)).toEqual(
    ["0123456789abcdef", "0123456789abcdef", "0123456789abcdef", "0123456789abcdef"].map((g) =>
      expect.stringContaining(g),
    ),
  );
  expect(decodeEscPos(encodeShiftReport(z, options)).commands.at(-1)).toMatchObject({
    name: "cut",
  });
});

test("the X says it is not a close, shows expected figures only and carries no anchor", () => {
  const all = lines(encodeShiftReport(x, options)).join("\n");
  expect(all).toContain("X REPORT");
  expect(all).toContain("not a close");
  expect(all).toMatch(/Expected in drawer\s+GHS 103\.60/);
  expect(all).not.toContain("Audit anchor");
  expect(all).not.toContain("Declared");
});

test("every line fits the paper, including 58 mm", () => {
  for (const paperMm of [58, 80] as const) {
    const cols = paperMm === 58 ? 32 : 48;
    for (const line of lines(encodeShiftReport(z, { ...options, paperMm })))
      expect(line.length).toBeLessThanOrEqual(cols);
  }
});

test("the printer test page names the model, the paper and the connection", () => {
  const all = lines(encodeTestPage(options.profile, 58, "epson", "Network 10.0.0.5:9100")).join(
    "\n",
  );
  expect(all).toContain("Printer test");
  expect(all).toContain("Model: epson");
  expect(all).toContain("Paper: 58 mm (32 columns)");
  expect(all).toContain("Network 10.0.0.5:9100");
});

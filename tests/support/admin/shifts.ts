// Closed shifts for the portal specs, uploaded the way a till does it: through the real API with a device credential.
//   seedShifts()        -> once per run, as the E2E Mart owner on the saved session: a till, a cashier and a manager; four closed shifts, newest first
//                          offsetting (cash -GHS 5.00, card +GHS 5.00), over (card +GHS 1.00), short (cash -GHS 6.00, a manager approved), balanced
import { expect, request as playwright, type APIRequestContext } from "@playwright/test";
import { v7 } from "uuid";
import { BOX_API, BRANCH_NAME, PORTAL_ORIGIN } from "../e2e";
import { enrolDevice, post, shopHeaders, unique } from "../admin";
import { createStaff } from "./people";

type Branch = { id: string; name: string; storeId: string };
type Counts = Record<string, number>;
const cashBalanced: Counts = { "500000": 1, "20000": 1, "10000": 1, "5000": 1, "1000": 1 };
const cashOffset: Counts = {
  "200000": 2,
  "50000": 1,
  "20000": 1,
  "10000": 1,
  "5000": 1,
  "1000": 1,
};
const cashShort: Counts = { "200000": 2, "50000": 1, "20000": 1, "5000": 1, "1000": 1 };

let seeded: ReturnType<typeof seed> | undefined;
export const seedShifts = () => (seeded ??= seed());

// Own session, so any spec can ask for the shifts, signed in as someone else or not.
async function seed() {
  const request = await playwright.newContext({ storageState: "tests/e2e/.auth/owner.json" });
  try {
    return await seedWith(request);
  } finally {
    await request.dispose();
  }
}

async function seedWith(request: APIRequestContext) {
  const headers = await shopHeaders(request);
  const branches = (await (
    await request.get(`${BOX_API}/branches`, { headers })
  ).json()) as Branch[];
  const branch = branches.find((row) => row.name === BRANCH_NAME)!;
  const cashier = await createStaff(request, "cashier", "Efua");
  const manager = await createStaff(request, "admin", "Kofi");
  const till = `Till ${unique()}`;
  const device = (await enrolDevice(request, branch.id, till)) as {
    deviceId: string;
    deviceToken: string;
  };
  await post(request, "/cashiers/pin", { userId: cashier.userId, pin: "482913" });
  const login = await request.post(`${BOX_API}/cashiers/login`, {
    headers,
    data: {
      deviceId: device.deviceId,
      deviceToken: device.deviceToken,
      userId: cashier.userId,
      pin: "482913",
    },
  });
  const session = (await login.json()) as { id: string; token: string; issuedAt: string };
  // Each close is a second after the last, inside the session that proves it.
  const at = (seconds: number) => new Date(Date.parse(session.issuedAt) + seconds * 1000);
  const upload = async (seconds: number, declared: Counts, card: number, approver?: string) => {
    const response = await request.post(`${BOX_API}/sync/shifts`, {
      headers: {
        authorization: `Bearer ${device.deviceToken}`,
        "X-Shopper-Device": device.deviceId,
        "X-Shopper-Org": headers["X-Shopper-Org"],
        Origin: PORTAL_ORIGIN,
      },
      data: {
        requestId: v7(),
        proof: session.token,
        shift: {
          v: 1,
          type: "shift.closed",
          shift: {
            orgId: headers["X-Shopper-Org"],
            sessionId: session.id,
            report: zReport(
              branch,
              cashier,
              till,
              device.deviceId,
              at(seconds),
              declared,
              card,
              approver,
            ),
          },
        },
      },
    });
    expect(await response.json()).toHaveProperty("accepted");
  };
  await upload(1, cashBalanced, 12_000);
  await upload(2, cashShort, 12_000, manager.userId);
  await upload(3, cashBalanced, 22_000);
  await upload(4, cashOffset, 62_000);
  return { till, cashier, manager };
}

// Float GHS 50, cash sales 4.90 less refunds 1.30: GHS 53.60 expected. Card 2.40 less 1.20: GHS 1.20. MoMo none.
const expected = { cash: 536_000, card: 12_000, momo: 0 };

function zReport(
  branch: Branch,
  cashier: { userId: string; name: string },
  till: string,
  deviceId: string,
  closedAt: Date,
  counts: Counts,
  card: number,
  approverId?: string,
) {
  const cash = Object.entries(counts).reduce((sum, [face, n]) => sum + Number(face) * n, 0);
  const declared = { cash, card, momo: 0 };
  const at = closedAt.toISOString();
  return {
    kind: "z",
    shiftId: v7(),
    storeId: branch.storeId,
    branchId: branch.id,
    deviceId,
    registerName: till,
    appVersion: "e2e",
    openedAt: new Date(closedAt.getTime() - 8 * 3_600_000).toISOString(),
    openedBy: cashier.userId,
    at,
    sales: { count: 3, gross: 73_000, tax: 12_101 },
    refunds: { count: 2, total: 25_000 },
    tenders: [
      { tender: "cash", sales: 49_000, refunds: 13_000, expected: expected.cash },
      { tender: "card", sales: 24_000, refunds: 12_000, expected: expected.card },
      { tender: "momo", sales: 0, refunds: 0, expected: expected.momo },
    ],
    cash: { float: 500_000, sales: 49_000, refunds: 13_000, drops: 0, expected: expected.cash },
    movements: [],
    cashiers: [{ userId: cashier.userId, name: cashier.name }],
    declared: { counts, ...declared },
    variances: (["cash", "card", "momo"] as const).map((tender) => ({
      tender,
      expected: expected[tender],
      declared: declared[tender],
      variance: declared[tender] - expected[tender],
    })),
    threshold: 50_000,
    approverId: approverId ?? null,
    closedAt: at,
    closedBy: cashier.userId,
    anchor: { seq: 41, hash: "c0ffee12".repeat(8) },
  };
}

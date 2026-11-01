// The shop in a browser: a fresh phone and client address per test, sign-in with the code the Arkesel fake received,
// and replayed answers that fill the account (the real API answers the empty and missing states).
//   startShopper(page)          -> { phone } with its own x-e2e-client address, so the per-address budgets stay apart
//   signIn(page, phone)         -> types the phone, reads the texted code, lands on the account
//   textedCode(phone)           -> the newest code the fake sent to that phone
//   replayAccount(page, over?)  -> serves a busy account: points, tier, four receipts (one with a PDF)
import { expect, type Page } from "@playwright/test";
import { e2eRun } from "../../../tooling/e2e/run";
import { goldenReceipt } from "../hardware/receipt";

export const SHOP = "e2e-mart";
const smsFake = `http://127.0.0.1:${e2eRun.port(3106)}/test/requests`;
let counter = 0;

export async function startShopper(page: Page) {
  counter += 1;
  const tail = `${Date.now() % 100_000}`.padStart(5, "0");
  const phone = `024${String(counter % 100).padStart(2, "0")}${tail}`;
  await page.setExtraHTTPHeaders({ "x-e2e-client": `198.51.100.${(counter % 250) + 1}-${tail}` });
  return { phone };
}

export async function textedCode(phone: string, after = 0) {
  const recipient = `233${phone.slice(1)}`;
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const sent = (await (await fetch(smsFake)).json()) as {
          message: string;
          recipients: string[];
        }[];
        const mine = sent.filter((sms) => sms.recipients.includes(recipient));
        code = mine.length > after ? mine.at(-1)!.message.slice(0, 6) : undefined;
        return code;
      },
      { timeout: 10_000 },
    )
    .toMatch(/^\d{6}$/);
  return code!;
}

export async function textsTo(phone: string) {
  const sent = (await (await fetch(smsFake)).json()) as { recipients: string[] }[];
  return sent.filter((sms) => sms.recipients.includes(`233${phone.slice(1)}`)).length;
}

export async function signIn(page: Page, phone: string) {
  await page.goto(`/${SHOP}/signin`);
  await page.getByLabel("Phone number").fill(phone);
  const before = await textsTo(phone);
  await page.getByRole("button", { name: "Text me a code" }).click();
  await page.getByLabel("Sign-in code").fill(await textedCode(phone, before));
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/account$`));
  // Loaded, not the skeleton: the page holds focus and its keys work.
  await expect(page.getByRole("button", { name: "You" })).toBeVisible();
}

const receipts = [
  {
    id: "01970000-0000-7000-8000-000000000001",
    day: "2026-10-31T17:42:00.000Z",
    total: 1_284_500,
    pdf: true,
  },
  {
    id: "01970000-0000-7000-8000-000000000002",
    day: "2026-10-24T09:05:00.000Z",
    total: 356_000,
    pdf: false,
  },
  {
    id: "01970000-0000-7000-8000-000000000003",
    day: "2026-10-12T12:30:00.000Z",
    total: 89_900,
    pdf: false,
  },
  {
    id: "01970000-0000-7000-8000-000000000004",
    day: "2026-09-28T15:15:00.000Z",
    total: 2_150_000,
    pdf: true,
  },
].map((item, index) => ({
  id: item.id,
  receiptNumber: `OSU1-T01-00048${index}`,
  occurredAt: item.day,
  total: item.total,
  status: "completed",
  branchName: index === 2 ? "East Legon" : "Osu",
  pdf: item.pdf,
}));
export const busyReceipts = receipts;

export async function replayAccount(page: Page, over: { points?: boolean } = {}) {
  await page.route(/\/api\/shop\/account\/points$/, (route) =>
    route.fulfill({
      json: {
        enabled: over.points ?? true,
        points: 1240,
        tier: { name: "Gold" },
        entries: [
          {
            id: "e1",
            reason: "earn",
            points: 128,
            saleId: receipts[0]!.id,
            occurredAt: receipts[0]!.occurredAt,
          },
        ],
      },
    }),
  );
  await page.route(/\/api\/shop\/account\/receipts$/, (route) =>
    route.fulfill({ json: { items: receipts } }),
  );
  await page.route(/\/api\/shop\/account\/receipts\/[^/]+$/, (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop();
    const item = receipts.find((receipt) => receipt.id === id);
    if (!item)
      return route.fulfill({ status: 404, json: { error: "We could not find that receipt" } });
    return route.fulfill({ json: { ...item, receipt: goldenReceipt() } });
  });
}

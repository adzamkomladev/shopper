// A shop's business verification, end to end: the owner submits it (the form itself is tests/e2e/portal/setup/
// verification.spec.ts; here the owner's session sends it straight to the API), the KYB workflow runs the automated
// checks, and a Shopper reviewer approves it in the admin app, which opens the shop's Paystack subaccount.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";
import { sha256 } from "@shopper/utils";
import { E2E_DATABASE_URL, E2E_STAFF } from "../../../tooling/database/e2e";
import { e2eRun } from "../../../tooling/e2e/run";
import { shopHeaders } from "../../support/admin";
import { MART, PORTAL_ORIGIN } from "../../support/e2e";

test("an owner's submission passes its checks and a reviewer approves it", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  await clearCase();
  const owner = await browser.newContext({ storageState: e2eRun.ownerState });
  await submitCase(owner.request);
  await owner.close();

  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_STAFF.email);
  await page.getByLabel("Password").fill(E2E_STAFF.password);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/kyb/);
  // The checks run on the portal's queue; the case reaches the In review tab once they pass.
  await expect(async () => {
    await page.goto("/kyb?status=in_review");
    await expect(page.getByRole("link", { name: `${MART.name} Ltd` })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("link", { name: `${MART.name} Ltd` }).click();
  const checks = page.getByRole("region", { name: "Automated checks" });
  await expect(checks.getByLabel("Failed")).toHaveCount(0);
  await expect(checks.getByLabel("Passed").first()).toBeVisible();

  await page.keyboard.press("A");
  await expect(page.getByLabel("Note (optional)")).toBeFocused();
  await page.keyboard.type("Documents match the registry extract.");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page).toHaveURL(/status=approved/);
  // The workflow opens the subaccount once the decision reaches it.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(`${MART.name} Ltd`) })).toContainText(
      "Subaccount open",
      { timeout: 2_000 },
    );
  }).toPass({ timeout: 60_000 });
});

/** E2E Mart starts each run with no case, so a reused server can run this again. */
async function clearCase() {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    const [{ id }] = (await client.query("SELECT id FROM org WHERE slug = $1", [MART.code])).rows;
    await client.query("DELETE FROM kyb_case WHERE org_id = $1", [id]);
  } finally {
    await client.end();
  }
}

async function submitCase(request: APIRequestContext) {
  const headers = await shopHeaders(request);
  const api = (path: string) => `${PORTAL_ORIGIN}/api${path}`;
  const upload = async (fileName: string) => {
    const bytes = new TextEncoder().encode(`${fileName} ${Date.now()}`);
    const granted = await request.post(api("/kyb/documents"), {
      headers,
      data: {
        fileName,
        contentType: "application/pdf",
        sizeBytes: bytes.byteLength,
        sha256: await sha256(bytes),
      },
    });
    expect(granted.status(), await granted.text()).toBe(201);
    const grant = (await granted.json()) as {
      assetId: string;
      url: string;
      headers: Record<string, string>;
    };
    const put = await fetch(grant.url, { method: "PUT", headers: grant.headers, body: bytes });
    expect(put.ok).toBe(true);
    return grant.assetId;
  };
  const inFiveYears = new Date(Date.now() + 5 * 365 * 86_400_000).toISOString().slice(0, 10);
  const saved = await request.put(api("/kyb"), {
    headers,
    data: {
      businessName: `${MART.name} Ltd`,
      registrationNumber: "CS123456789",
      tin: "C0012345678",
      settlementBank: "040",
      settlementAccount: "1234567890123",
      directors: [
        {
          name: "Ama Mensah",
          ghanaCard: "GHA-123456789-0",
          cardExpiresOn: inFiveYears,
          cardAssetId: await upload("card.pdf"),
        },
      ],
      documents: [
        { kind: "registration_certificate", assetId: await upload("reg.pdf"), expiresOn: null },
        { kind: "tin_certificate", assetId: await upload("tin.pdf"), expiresOn: null },
      ],
    },
  });
  expect(saved.status(), await saved.text()).toBe(200);
  const submitted = await request.post(api("/kyb/submit"), { headers });
  expect(submitted.status(), await submitted.text()).toBe(202);
}

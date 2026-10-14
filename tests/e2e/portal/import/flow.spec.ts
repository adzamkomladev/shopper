/// <reference types="node" />
import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../support/e2e";
import { tagOf } from "../../../support/catalogue";
import {
  checkFile,
  cleanRows,
  errorRow,
  errorsTable,
  expectCounts,
  messyRows,
  openImports,
  openTagged,
  screenshotAt,
  writeSheet,
} from "../../../support/import";

// Runs on the saved owner session. Every test builds its own file with a tag that is new each time,
// so products from earlier runs on a reused server never show up in its searches.
test.describe("importing a spreadsheet as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await openImports(page);
  });

  test("a dry run of a messy file reports bad rows by row and column and writes nothing", async ({
    page,
  }, info) => {
    const tag = tagOf();
    const { rows, bad } = messyRows(tag);
    await checkFile(page, writeSheet(info, rows, "xlsx"));

    await expectCounts(page, 3, 3);
    await expect(errorsTable(page).getByRole("columnheader")).toHaveText([
      "Row",
      "Column",
      "Problem",
    ]);
    for (const problem of bad) {
      const line = errorRow(page, problem);
      await expect(line).toHaveCount(1);
      await expect(line.getByRole("cell").last()).not.toBeEmpty();
    }
    // One line per bad row and nothing else: the good rows are not listed as errors.
    await expect(
      errorsTable(page)
        .getByRole("row")
        .filter({ has: page.getByRole("cell") }),
    ).toHaveCount(bad.length);
    await expect(page.getByRole("button", { name: "Import 3 products" })).toBeEnabled();

    // A check only reads: none of the file's rows, good or bad, are in the catalogue.
    await openTagged(page, tag);
    await expect(page.getByText("No products match")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: tag })).toHaveCount(0);
  });

  test("a browser without Web Crypto explains how to open a secure connection", async ({
    page,
  }, info) => {
    await page.addInitScript(() => {
      Object.defineProperty(globalThis.crypto, "subtle", { value: undefined });
    });
    await page.reload();
    const grants: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/catalogue/imports/uploads")) grants.push(request.url());
    });
    await checkFile(page, writeSheet(info, cleanRows(tagOf(), 1), "csv"));
    await expect(page.getByRole("alert")).toContainText(
      "Open the portal using HTTPS to upload files.",
    );
    expect(grants).toEqual([]);
  });

  test("spreadsheet bytes go directly to object storage and commit uses the reviewed asset", async ({
    page,
  }, info) => {
    const requests: import("@playwright/test").Request[] = [];
    page.on("request", (request) => {
      if (request.method() === "PUT" || request.url().includes("/catalogue/imports"))
        requests.push(request);
    });
    await checkFile(page, writeSheet(info, cleanRows(tagOf(), 2), "csv"));
    await page.getByRole("button", { name: /Import .* products/ }).click();
    await expect(page.getByRole("link", { name: "View products" })).toBeVisible();
    const put = requests.find((request) => request.method() === "PUT")!;
    expect(new URL(put.url()).pathname).toContain("/imports/");
    expect(put.headers()).not.toHaveProperty("cookie");
    expect(put.headers()).not.toHaveProperty("x-shopper-org");
    expect(put.headers()).not.toHaveProperty("authorization");
    const processing = requests.filter(
      (request) =>
        request.url().includes("/catalogue/imports") && !request.url().includes("/uploads"),
    );
    expect(processing).toHaveLength(2);
    expect(processing[0]!.postDataJSON()).toEqual(processing[1]!.postDataJSON());
    for (const request of processing) {
      expect(request.headers()["content-type"]).toBe("application/json");
      expect(Object.keys(request.postDataJSON())).toEqual(["assetId"]);
    }
  });

  test("running the import adds the good rows to the list", async ({ page }, info) => {
    const tag = tagOf();
    const { rows } = messyRows(tag);
    await checkFile(page, writeSheet(info, rows, "xlsx"));
    await expectCounts(page, 3, 3);

    await page.getByRole("button", { name: "Import 3 products" }).click();
    const viewProducts = page.getByRole("link", { name: "View products" });
    await expect(viewProducts).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Check file" })).toBeHidden();

    await viewProducts.click();
    await expect(page).toHaveURL(/\/products/);
    const listed = await openTagged(page, tag);
    await expect(listed).toHaveCount(3);
    // Rows 2 to 4 are the good ones; the missing-name, bad-price and duplicate-barcode rows are not.
    for (const good of rows.slice(0, 3))
      await expect(listed.filter({ hasText: String(good.SKU) })).toHaveCount(1);
    for (const skipped of rows.slice(3)) {
      await expect(listed.filter({ hasText: String(skipped.SKU) })).toHaveCount(0);
    }
  });

  test("a clean file shows no errors and can be imported straight away", async ({ page }, info) => {
    const tag = tagOf();
    const rows = cleanRows(tag, 4);
    await checkFile(page, writeSheet(info, rows, "csv"));

    await expectCounts(page, 4, 0);
    await expect(errorsTable(page)).toHaveCount(0);
    const run = page.getByRole("button", { name: "Import 4 products" });
    await expect(run).toBeEnabled();
    await run.click();
    await expect(page.getByRole("link", { name: "View products" })).toBeVisible({
      timeout: 20_000,
    });

    await expect(await openTagged(page, tag)).toHaveCount(4);
  });

  test("Mod+Enter checks the chosen file, then imports it, with focus kept on the page", async ({
    page,
  }, info) => {
    const input = page.getByLabel("Spreadsheet");
    await input.focus();
    await input.setInputFiles(writeSheet(info, cleanRows(tagOf(), 2), "csv"));
    await page.keyboard.press("ControlOrMeta+Enter");
    await expectCounts(page, 2, 0);
    // The Check button is gone; focus moved into the report, so the next key press still lands.
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByRole("link", { name: "View products" })).toBeVisible({
      timeout: 20_000,
    });
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  });

  test("a file with only a header row says it has no products", async ({ page }, info) => {
    const path = info.outputPath("empty.csv");
    writeFileSync(path, "SKU,Name,Selling Price,Tax Class\n");
    await checkFile(page, path);
    await expect(page.getByText("The file has no product rows.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Import products" })).toBeDisabled();
  });

  test("dropping two files asks for one and keeps the chosen file", async ({ page }, info) => {
    await page
      .getByLabel("Spreadsheet")
      .setInputFiles(writeSheet(info, cleanRows(tagOf(), 1), "csv"));
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["a"], "one.csv"));
      transfer.items.add(new File(["b"], "two.csv"));
      document
        .querySelector("[data-dragging]")
        ?.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true }));
    });
    await expect(page.getByText("Drop one file at a time.")).toBeVisible();
    await expect(page.getByText("catalogue.csv")).toBeVisible();
    await expect(page.getByRole("button", { name: "Check file" })).toBeEnabled();
  });

  test("an import whose reply cannot be read says it may have finished", async ({ page }, info) => {
    await page.route(
      (url) => url.pathname === "/api/catalogue/imports" && !url.search,
      (route) => route.fulfill({ status: 201, json: { unexpected: true } }),
    );
    await checkFile(page, writeSheet(info, cleanRows(tagOf(), 1), "csv"));
    await page.getByRole("button", { name: "Import 1 product" }).click();
    await expect(page.getByRole("alert")).toContainText("The import may have finished");
    await expect(page.getByRole("button", { name: "Import 1 product" })).toBeEnabled();
  });

  test("a file over 10 MB is turned away on the field, before any upload", async ({ page }) => {
    await page.getByLabel("Spreadsheet").setInputFiles({
      name: "huge.csv",
      mimeType: "text/csv",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
    await expect(page.getByText(/larger than 10 MB/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Check file" })).toBeDisabled();
  });

  test("offline disables Check file and says why", async ({ page, context }, info) => {
    await page
      .getByLabel("Spreadsheet")
      .setInputFiles(writeSheet(info, cleanRows(tagOf(), 1), "csv"));
    const check = page.getByRole("button", { name: "Check file" });
    await expect(check).toBeEnabled();
    await context.setOffline(true);
    await expect(check).toBeDisabled();
    await expect(check).toHaveAccessibleDescription(/offline/i);
    await context.setOffline(false);
    await expect(check).toBeEnabled();
  });

  test("the import screen has no serious axe violations and renders at two sizes", async ({
    page,
  }, info) => {
    await expect(page.getByLabel("Spreadsheet")).toBeAttached();
    await expect(page.getByRole("button", { name: "Check file" })).toBeVisible();
    await expectNoSeriousAxe(page);
    await screenshotAt(page, info, "import-idle");

    await page.setViewportSize({ width: 1366, height: 768 });
    const { rows } = messyRows(tagOf());
    await checkFile(page, writeSheet(info, rows, "xlsx"));
    await expectCounts(page, 3, 3);
    await expectNoSeriousAxe(page);
    await screenshotAt(page, info, "import-report");
  });
});

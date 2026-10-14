import { expect, test } from "@playwright/test";
import { tagOf } from "../../../support/catalogue";
import { expectCounts, openImports } from "../../../support/import";

for (const mimeType of ["text/plain", "application/csv"]) {
  test(`a valid CSV with browser MIME ${mimeType} uses the safe signed upload type`, async ({
    page,
  }) => {
    await openImports(page);
    const tag = tagOf();
    await page.getByLabel("Spreadsheet").evaluate(
      (input: HTMLInputElement, file) => {
        const files = new DataTransfer();
        files.items.add(new File([file.content], "catalogue.csv", { type: file.mimeType }));
        input.files = files.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { mimeType, content: `SKU,Name,Selling Price,Tax Class\n${tag},MIME product,2.50,Standard` },
    );
    expect(
      await page
        .getByLabel("Spreadsheet")
        .evaluate((input: HTMLInputElement) => input.files?.[0]?.type),
    ).toBe(mimeType);
    const issued = page.waitForRequest(
      (request) =>
        request.url().includes("/catalogue/imports/uploads") && request.method() === "POST",
    );
    await page.getByRole("button", { name: "Check file" }).click();
    expect((await issued).postDataJSON().contentType).toBe("application/octet-stream");
    await expectCounts(page, 1, 0);
    await page.getByRole("button", { name: "Import 1 product", exact: true }).click();
    await expect(page.getByRole("link", { name: "View products" })).toBeVisible();
  });
}

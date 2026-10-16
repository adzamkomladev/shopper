import { expect, type Page } from "@playwright/test";

export async function expectTouchTargets(page: Page) {
  const dialogs = page.locator('[data-state="open"][data-slot="dialog-content"]');
  if (await dialogs.count())
    await dialogs.evaluateAll(async (elements) => {
      await Promise.all(
        elements.flatMap((element) => element.getAnimations()).map((x) => x.finished),
      );
    });
  const undersized = await page
    .locator("button:enabled, input:enabled, textarea:enabled, [role=combobox]")
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => ({
          label:
            element.getAttribute("aria-label") ||
            (element instanceof HTMLInputElement
              ? element.labels?.[0]?.textContent?.trim()
              : null) ||
            element.textContent?.trim() ||
            element.tagName.toLowerCase(),
          height: Math.round(element.getBoundingClientRect().height),
        }))
        .filter((target) => target.height < 44),
    );
  expect(undersized).toEqual([]);
}

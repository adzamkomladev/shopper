// The one place an email's markup is made: every sender hands it content, never HTML.
import { expect, test } from "vite-plus/test";
import { emailColors, renderEmail } from "@shopper/core/emails";
import { contrast, themeToken } from "../../support/emails/theme";

const sample = {
  preheader: "Your invoice is ready",
  shop: "Kojo & Sons <Mart>",
  heading: "Your Shopper invoice is ready",
  blocks: [
    { kind: "text", text: "Hello <b>owner</b>, GH₵ 120.00 is due." },
    {
      kind: "facts",
      rows: [
        { label: "Net sales", value: "GH₵ 12.00", note: "yesterday GH₵ 10.00" },
        { label: "Transactions", value: "3" },
      ],
    },
    { kind: "list", title: "Registers", items: ["Till 1", "Till <2>"] },
    { kind: "notice", text: "The back office is read-only." },
  ],
  action: { label: "Pay invoice", url: "https://pay.example/c?id=1&token=a b" },
  footnote: "If you did not expect this, ignore it.",
} as const;

test("anything a shop or customer typed is escaped, in the markup and nowhere else", () => {
  const { html, plain } = renderEmail(sample);
  expect(html).not.toContain("<b>owner</b>");
  expect(html).not.toContain("Till <2>");
  expect(html).toContain("Kojo &amp; Sons &lt;Mart&gt;");
  expect(plain).toContain("Till <2>");
});

test("the button carries the link as an escaped href and again as text for clients that strip buttons", () => {
  const { html, plain } = renderEmail(sample);
  expect(html).toContain('href="https://pay.example/c?id=1&amp;token=a%20b"');
  expect(html).toMatch(/>\s*Pay invoice\s*</);
  expect(plain.split("\n\n")).toContain("Pay invoice: https://pay.example/c?id=1&token=a%20b");
});

test("a link that is not http(s) is refused rather than rendered", () => {
  expect(() =>
    renderEmail({ ...sample, action: { label: "Open", url: "javascript:alert(1)" } }),
  ).toThrow();
});

test("the plain part reads in order with every block, and money rows keep their comparison", () => {
  const { plain } = renderEmail(sample);
  expect(plain.startsWith("Your Shopper invoice is ready\n\n")).toBe(true);
  expect(plain).toContain("Net sales: GH₵ 12.00 (yesterday GH₵ 10.00)");
  expect(plain).toContain("Registers\n- Till 1\n- Till <2>");
  expect(plain.indexOf("Hello")).toBeLessThan(plain.indexOf("Net sales"));
  expect(plain.trimEnd().endsWith("If you did not expect this, ignore it.")).toBe(true);
});

test("the markup is email-safe: tables, inline colour, no CSS the clients drop", () => {
  const { html } = renderEmail(sample);
  expect(html.startsWith("<!doctype html>")).toBe(true);
  expect(html).toContain('<html lang="en"');
  expect(html).toContain('name="color-scheme" content="light dark"');
  expect(html).toContain('role="presentation"');
  for (const unsupported of [
    /oklch\(/,
    /var\(--/,
    /light-dark\(/,
    /display:\s*flex/,
    /<script/,
    /@import/,
  ])
    expect(html).not.toMatch(unsupported);
});

test("the preheader is hidden from the layout but present for the inbox list", () => {
  const { html } = renderEmail(sample);
  expect(html).toMatch(/display:none[^>]*>\s*Your invoice is ready/);
});

test("the colours are the @shopper/ui tokens, light and dark", () => {
  for (const name of [
    "background",
    "foreground",
    "primary",
    "primary-foreground",
    "muted-foreground",
    "border",
    "page",
    "warning",
    "warning-foreground",
    "warning-border",
  ] as const) {
    const key = name.replace(/-(\w)/g, (_, c: string) =>
      c.toUpperCase(),
    ) as keyof typeof emailColors;
    expect(emailColors[key], name).toEqual(themeToken(name));
  }
});

test("text keeps AA contrast on the surface it sits on in both schemes", () => {
  for (const scheme of ["light", "dark"] as const) {
    const c = (key: keyof typeof emailColors) => emailColors[key][scheme];
    expect(contrast(c("foreground"), c("background")), `${scheme} body`).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrast(c("mutedForeground"), c("background")),
      `${scheme} muted`,
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(c("primaryForeground"), c("primary")),
      `${scheme} button`,
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c("primary"), c("background")), `${scheme} link`).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(c("warningForeground"), c("warning")),
      `${scheme} notice`,
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c("mutedForeground"), c("page")), `${scheme} footer`).toBeGreaterThanOrEqual(
      4.5,
    );
  }
});

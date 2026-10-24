/** A shop that never gave its VAT registration date counts as registered since before it used Shopper. */
export const registeredSince = "2000-01-01";

// Statutory Ghana rates; tax_rule rows are seeded from this, never read at sale time.
export const ghana2026 = Object.freeze({
  effectiveFrom: "2026-01-01",
  vatBps: 1_500,
  nhilBps: 250,
  getfundBps: 250,
  covidBps: 0,
  source: "https://gra.gov.gh/news/portfolio/notice-to-all-vat-registered-taxpayers/",
});

// The field allowlist for everything a box sends its relay (v1.5 Day 52): every key of every request body, at any
// depth, is on its path's list. A receipt document is the printed receipt itself, so its inside is not walked.
//   expectAllowed(requests, ["/relay/images"])  -> fails on any other key, or when a named path was never sent
import { expect } from "vite-plus/test";

const row = {
  shop: "id tin vatRegisteredFrom priceMode taxRules effectiveFrom vatBps nhilBps getfundBps covidBps source",
  catalogue:
    "stores branches fulfilment categories products prices availability id name storeId branchId pickup delivery deliveryFee opens closes slotMinutes slotCapacity leadMinutes parentId onlineVisible sku categoryId taxClass baseUnit image productId amount validFrom validTo branches available",
};
const allowed: Record<string, Set<string>> = {
  "/relay/publish": new Set(`shop ${row.shop} ${row.catalogue}`.split(" ")),
  "/relay/customers": new Set(
    "customers withdrawn id phone points enabled tier name entries reason saleId occurredAt receipts receiptNumber total status branchName receipt".split(
      " ",
    ),
  ),
  "/relay/orders/events": new Set(["events", "open", "id", "status"]),
  "/relay/images": new Set(["sha256", "sizeBytes", "contentType"]),
  "/relay/heartbeat": new Set(),
};

export function expectAllowed(requests: { path: string; body?: string }[], exercised: string[]) {
  const paths = requests.map((request) => request.path.split("?")[0]!);
  expect(paths).toEqual(expect.arrayContaining(exercised));
  for (const [index, request] of requests.entries()) {
    if (!request.body) continue;
    const list = allowed[paths[index]!];
    expect(list, `${paths[index]} is a path the box may send to`).toBeDefined();
    for (const key of keysOf(JSON.parse(request.body))) expect(list, paths[index]).toContain(key);
  }
}

const keysOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(keysOf)
    : value && typeof value === "object"
      ? Object.entries(value).flatMap(([key, inner]) => [
          key,
          ...(key === "receipt" ? [] : keysOf(inner)),
        ])
      : [];

// What the reports API answers for a busy shop, replayed in the portal e2e specs so every filled state is drawn.
// The figures themselves are proved against real sales in tests/integration/reports.
const kpi = (value: number, yesterday: number, changeBps: number | null) => ({
  value,
  yesterday,
  changeBps,
});

export const busyDashboard = {
  day: "2026-10-15",
  yesterday: "2026-10-14",
  kpis: {
    netSales: kpi(48_250_000, 41_900_000, 1_516),
    transactions: kpi(132, 118, 1_186),
    basket: kpi(3_655_303, 3_550_847, 294),
    itemsPerBasket: kpi(4_250, 4_500, -556),
    refunds: kpi(820_000, 0, null),
    margin: kpi(9_640_000, 8_100_000, 1_901),
  },
  top: [
    ["Royal Aroma Jasmine Rice 5 kg", 9_800_000, 28_000],
    ["Frytol Cooking Oil 1 L", 6_120_000, 51_000],
    ["Milo Tin 400 g", 4_400_000, 22_000],
    ["Ideal Evaporated Milk 160 g", 2_930_000, 97_500],
    ["Voltic Mineral Water 1.5 L", 1_710_000, 114_000],
  ].map(([name, netSales, quantity], index) => ({
    productId: `0190a0b0-0000-7000-8000-00000000000${index}`,
    name: name as string,
    netSales: netSales as number,
    quantity: quantity as number,
  })),
  tenders: [
    { kind: "cash", label: "Cash", transactions: 71, net: 24_150_000, shareBps: 5_005 },
    { kind: "momo", label: "MoMo", transactions: 49, net: 18_300_000, shareBps: 3_793 },
    { kind: "card", label: "Card", transactions: 12, net: 5_800_000, shareBps: 1_202 },
  ],
  hours: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    today: hour >= 7 && hour <= 20 ? (((hour * 37) % 11) + 2) * 400_000 : 0,
    yesterday: hour >= 7 && hour <= 20 ? (((hour * 53) % 9) + 2) * 380_000 : 0,
  })),
};

const salesRow = (key: string, label: string, n: number) => ({
  key,
  label,
  transactions: 100 + n * 7,
  items: (420 + n * 31) * 1000,
  gross: 40_000_000 + n * 1_250_000,
  discount: 350_000 + n * 10_000,
  tax: 7_400_000 + n * 220_000,
  net: 32_250_000 + n * 1_020_000,
  refunds: n % 3,
  refundGross: (n % 3) * 410_000,
  netSales: 40_000_000 + n * 1_250_000 - (n % 3) * 410_000,
  basket: 380_000,
});
const days = Array.from({ length: 15 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
const sum = (rows: Record<string, number | string>[], key: string) =>
  rows.reduce((total, row) => total + (row[key] as number), 0);
const salesRows = days.map((day, i) => salesRow(day, day, i));
export const busySales = {
  by: "day",
  rows: salesRows,
  total: {
    ...salesRow("total", "Total", 0),
    ...Object.fromEntries(
      [
        "transactions",
        "items",
        "gross",
        "discount",
        "tax",
        "net",
        "refunds",
        "refundGross",
        "netSales",
      ].map((key) => [key, sum(salesRows, key)]),
    ),
  },
};

export const busyProducts = {
  rows: busyDashboard.top.map((product, index) => ({
    productId: product.productId,
    sku: `SKU-${1000 + index}`,
    name: product.name,
    quantity: product.quantity,
    refundQuantity: index === 1 ? 1000 : 0,
    gross: product.netSales,
    revenue: Math.round(product.netSales * 0.82),
    cost: index === 4 ? 0 : Math.round(product.netSales * 0.6),
    margin: Math.round(product.netSales * (index === 4 ? 0.82 : 0.22)),
    marginBps: index === 4 ? 10_000 : 2_683,
    costed: index === 4 ? "none" : index === 2 ? "some" : "all",
  })),
  total: {
    revenue: 20_473_000,
    cost: 13_950_000,
    margin: 6_523_000,
    marginBps: 3_186,
    uncosted: 2,
  },
};

export const busyBranches = {
  rows: [
    ["Accra Central", 820, 312_000_000, 4_100_000, 6_200],
    ["Kumasi Adum", 505, 191_400_000, 1_200_000, 3_800],
  ].map(([name, transactions, gross, refundGross, shareBps], index) => ({
    branchId: `0190a0b0-0000-7000-8000-0000000001${index}0`,
    name: name as string,
    transactions: transactions as number,
    gross: gross as number,
    refundGross: refundGross as number,
    netSales: (gross as number) - (refundGross as number),
    basket: Math.round((gross as number) / (transactions as number)),
    margin: Math.round((gross as number) * 0.18),
    shareBps: shareBps as number,
  })),
  total: {
    transactions: 1325,
    gross: 503_400_000,
    refundGross: 5_300_000,
    netSales: 498_100_000,
    basket: 379_925,
    margin: 90_612_000,
    shareBps: 10_000,
  },
};

export const busyDeadStock = {
  days: 30,
  asOf: "2026-10-15",
  rows: [
    ["Gino Tomato Paste 70 g", 48_000, "2026-08-30", 18_500],
    ["Peak Milk Powder 900 g", 6_000, null, 1_120_000],
    ["Lipton Yellow Label 100 bags", 12_500, "2026-09-02", null],
  ].map(([name, onHand, lastSale, unitCost], index) => ({
    branchId: busyBranches.rows[0]!.branchId,
    branch: "Accra Central",
    productId: `0190a0b0-0000-7000-8000-00000000020${index}`,
    sku: `SKU-${2000 + index}`,
    name: name as string,
    onHand: onHand as number,
    lastSale: lastSale as string | null,
    unitCost: unitCost as number | null,
    value: unitCost === null ? 0 : Math.round(((unitCost as number) * (onHand as number)) / 1000),
  })),
  total: 7_608_000,
};

const entry = (day: string, lines: [string, number, number][]) =>
  lines.map(([account, debit, credit]) => ({
    day,
    branchId: busyBranches.rows[0]!.branchId,
    branch: "Accra Central",
    account,
    debit,
    credit,
  }));
export const busyJournal = {
  rows: ["2026-10-14", "2026-10-15"].flatMap((day) =>
    entry(day, [
      ["Cash", 24_150_000, 0],
      ["MoMo", 18_300_000, 0],
      ["Sales returns", 700_000, 0],
      ["Sales", 0, 36_250_000],
      ["VAT", 0, 5_437_500],
      ["NHIL", 0, 906_250],
      ["GETFund levy", 0, 556_250],
    ]),
  ),
  total: { debit: 86_300_000, credit: 86_300_000 },
};

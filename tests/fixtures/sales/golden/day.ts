import type { GoldenSale } from "./types";

export const tradingDay: GoldenSale[] = [
  {
    name: "cash with change",
    lines: [{ product: "standard" }],
    tenders: [{ kind: "cash", amount: 200_000 }],
  },
  {
    name: "cash rounds up",
    lines: [{ product: "up" }],
    tenders: [{ kind: "cash", amount: 20_000 }],
  },
  {
    name: "cash rounds down",
    lines: [{ product: "down" }],
    tenders: [{ kind: "cash", amount: 20_000 }],
  },
  {
    name: "exact MoMo",
    lines: [{ product: "standard" }],
    tenders: [{ kind: "momo", amount: 120_000 }],
  },
  {
    name: "manual card",
    lines: [{ product: "standard" }],
    tenders: [{ kind: "card", amount: 120_000 }],
  },
  {
    name: "three way split",
    lines: [{ product: "standard" }],
    tenders: [
      { kind: "momo", amount: 40_000 },
      { kind: "card", amount: 30_000 },
      { kind: "cash", amount: 60_000 },
    ],
  },
  {
    name: "zero rated cash",
    lines: [{ product: "zero" }],
    tenders: [{ kind: "cash", amount: 50_000 }],
  },
  {
    name: "exempt card",
    lines: [{ product: "exempt" }],
    tenders: [{ kind: "card", amount: 50_000 }],
  },
  {
    name: "mixed tax classes",
    lines: [{ product: "standard" }, { product: "zero" }, { product: "exempt" }],
    tenders: [{ kind: "cash", amount: 200_000 }],
  },
  {
    name: "line discount",
    lines: [{ product: "standard", discount: 12_000 }],
    tenders: [{ kind: "cash", amount: 110_000 }],
  },
  {
    name: "weighed label",
    lines: [{ product: "weighed", code: "2100001005009" }],
    tenders: [{ kind: "cash", amount: 200_000 }],
  },
  {
    name: "price label",
    lines: [{ product: "labelled", code: "2200002001007" }],
    tenders: [{ kind: "cash", amount: 20_000 }],
  },
  {
    name: "held resumed paid",
    lines: [{ product: "standard" }],
    held: true,
    tenders: [{ kind: "cash", amount: 120_000 }],
  },
  { name: "void before tender", lines: [{ product: "standard" }], voided: true, tenders: [] },
  {
    name: "two units card",
    lines: [{ product: "standard", quantity: 2000 }],
    tenders: [{ kind: "card", amount: 240_000 }],
  },
  {
    name: "card cash change",
    lines: [{ product: "standard" }],
    tenders: [
      { kind: "card", amount: 100_000 },
      { kind: "cash", amount: 50_000 },
    ],
  },
  {
    name: "mixed discounted",
    lines: [{ product: "standard", discount: 24_000 }, { product: "zero" }],
    tenders: [{ kind: "cash", amount: 130_000 }],
  },
  {
    name: "weighed discounted",
    lines: [{ product: "weighed", quantity: 500, discount: 18_000 }],
    tenders: [{ kind: "card", amount: 162_000 }],
  },
  {
    name: "cash rounding disabled",
    lines: [{ product: "up" }],
    rounding: "none",
    tenders: [{ kind: "cash", amount: 20_000 }],
  },
  {
    name: "zero and exempt MoMo",
    lines: [{ product: "zero", quantity: 2000 }, { product: "exempt" }],
    tenders: [{ kind: "momo", amount: 110_000 }],
  },
  {
    name: "fully discounted sale",
    lines: [{ product: "standard", discount: 120_000 }],
    tenders: [{ kind: "cash", amount: 0 }],
  },
];

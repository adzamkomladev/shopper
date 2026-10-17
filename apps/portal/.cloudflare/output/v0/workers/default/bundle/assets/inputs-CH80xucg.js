import {
  A as maxValue,
  B as parse,
  C as integer$1,
  D as literal,
  E as isoTimestamp,
  F as nullable,
  G as rawTransform,
  H as picklist,
  I as number,
  J as safeInteger,
  L as object,
  M as minValue,
  O as looseObject,
  Q as string,
  U as pipe,
  V as partial,
  Y as safeParse,
  Z as strictObject,
  _ as check,
  at as uuid,
  d as sequenceSchema,
  et as transform,
  f as uuidV7Schema,
  g as brand,
  h as boolean,
  j as minLength,
  k as maxLength,
  m as array,
  ot as variant,
  q as regex,
  tt as trim,
  z as optional,
} from "./react-dom-BCYT53bd.js";
//#region ../../packages/money/src/schemas/money.ts
var integer = pipe(number(), safeInteger());
var moneySchema = pipe(integer, brand("Money"));
//#endregion
//#region ../../packages/money/src/arithmetic.ts
function money(value) {
  return parse(moneySchema, value);
}
function fromBigInt(value) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER))
    throw new RangeError("Money exceeds the safe integer range");
  return money(Number(value));
}
function divide(value, denominator) {
  if (denominator <= 0n) throw new RangeError("Denominator must be positive");
  const rounded = ((value < 0n ? -value : value) + denominator / 2n) / denominator;
  return value < 0n ? -rounded : rounded;
}
function add(a, b) {
  return fromBigInt(BigInt(money(a)) + BigInt(money(b)));
}
function sub(a, b) {
  return fromBigInt(BigInt(money(a)) - BigInt(money(b)));
}
function mulRatio(amount, numerator, denominator) {
  parse(integer, numerator);
  parse(integer, denominator);
  return fromBigInt(divide(BigInt(money(amount)) * BigInt(numerator), BigInt(denominator)));
}
function mulQty(amount, thousandths) {
  return mulRatio(amount, thousandths, 1e3);
}
function mulRate(amount, basisPoints) {
  return mulRatio(amount, basisPoints, 1e4);
}
//#endregion
//#region ../../packages/money/src/format.ts
var MONEY_SCALE = 1e4;
function fromDecimal(value) {
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(value))
    throw new TypeError("Expected a decimal with at most 4 places");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const amount = BigInt(whole) * BigInt(MONEY_SCALE) + BigInt(fraction.padEnd(4, "0"));
  return fromBigInt(negative ? -amount : amount);
}
function toDecimal(amount, places = 2) {
  if (places !== 2 && places !== 4) throw new RangeError("Supported precision: 2 or 4");
  const units = divide(BigInt(money(amount)), places === 2 ? 100n : 1n);
  const magnitude = units < 0n ? -units : units;
  const scale = places === 2 ? 100n : 10000n;
  return `${units < 0n ? "-" : ""}${magnitude / scale}.${String(magnitude % scale).padStart(places, "0")}`;
}
function formatGHS(amount) {
  const [whole, fraction] = toDecimal(amount).split(".");
  return `GH₵ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
//#endregion
//#region ../../packages/tax/src/schemas/tax/rule.ts
var rate = pipe(number(), integer$1(), minValue(0), maxValue(1e4));
var taxClassSchema = picklist(["standard", "zero-rated", "exempt"]);
var dateSchema = pipe(
  string(),
  regex(/^\d{4}-\d{2}-\d{2}$/),
  check((value) => {
    const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
    return (
      !value.startsWith("0000-") &&
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Expected a calendar date"),
);
var taxRuleSchema = object({
  id: pipe(string(), uuid()),
  effectiveFrom: dateSchema,
  vatBps: rate,
  nhilBps: rate,
  getfundBps: rate,
  covidBps: rate,
});
//#endregion
//#region ../../packages/tax/src/rules.ts
var ghana2026 = Object.freeze({
  effectiveFrom: "2026-01-01",
  vatBps: 1500,
  nhilBps: 250,
  getfundBps: 250,
  covidBps: 0,
  source: "https://gra.gov.gh/news/portfolio/notice-to-all-vat-registered-taxpayers/",
});
//#endregion
//#region ../../packages/tax/src/schemas/snapshot.ts
var priceModeSchema = picklist(["inclusive", "exclusive"]);
var quantitySchema = pipe(number(), safeInteger(), minValue(0));
//#endregion
//#region ../../packages/tax/src/snapshot.ts
function snapshotLine(input) {
  const amount = mulQty(input.unitPrice, input.quantityThousandths);
  const discount = money(input.discount ?? 0);
  if (discount < 0 || discount > amount) throw new RangeError("Invalid line discount");
  const taxable = sub(amount, discount);
  if (input.priceMode === "inclusive")
    return Object.freeze({
      ...snapshotAmount({
        ...input,
        gross: taxable,
      }),
      discount,
    });
  return breakdown(input, taxable, discount);
}
/** Tax breakdown extracted from an authoritative inclusive gross; unit price and quantity are recorded as given. */
function snapshotAmount(input) {
  if (input.priceMode !== "inclusive")
    throw new RangeError("Only inclusive amounts can be extracted");
  const gross = money(input.gross);
  if (gross < 0) throw new RangeError("Gross must not be negative");
  const unitPrice = money(input.unitPrice);
  if (unitPrice < 0) throw new RangeError("Unit price must not be negative");
  return breakdown(
    {
      ...input,
      unitPrice,
    },
    gross,
    money(0),
  );
}
function breakdown(input, taxable, discount) {
  const rule = parse(taxRuleSchema, input.rule);
  const on = parse(dateSchema, input.on);
  const taxClass = parse(taxClassSchema, input.taxClass);
  if (rule.effectiveFrom > on) throw new RangeError("Tax rule is not yet effective");
  parse(priceModeSchema, input.priceMode);
  parse(quantitySchema, input.quantityThousandths);
  const rates =
    taxClass === "standard"
      ? rule
      : {
          vatBps: 0,
          nhilBps: 0,
          getfundBps: 0,
          covidBps: 0,
        };
  const sum = rates.vatBps + rates.nhilBps + rates.getfundBps + rates.covidBps;
  const base = input.priceMode === "inclusive" ? mulRatio(taxable, 1e4, 1e4 + sum) : taxable;
  const vat = mulRate(base, rates.vatBps);
  const nhil = mulRate(base, rates.nhilBps);
  const getfund = mulRate(base, rates.getfundBps);
  const covid = mulRate(base, rates.covidBps);
  const calculatedGross = [vat, nhil, getfund, covid].reduce(add, base);
  const gross = input.priceMode === "inclusive" ? taxable : calculatedGross;
  return Object.freeze({
    rule: Object.freeze(rule),
    on,
    taxClass,
    priceMode: input.priceMode,
    quantityThousandths: input.quantityThousandths,
    unitPrice: input.unitPrice,
    discount,
    base,
    vat,
    nhil,
    getfund,
    covid,
    gross,
    roundingAdjustment: sub(gross, calculatedGross),
  });
}
//#endregion
//#region ../../packages/core/src/schemas/fields.ts
var text = (max) => pipe(string(), trim(), minLength(1), maxLength(max));
var name = text(200);
var positiveInt = pipe(number(), safeInteger(), minValue(1), maxValue(2147483647));
var timestamp$1 = pipe(
  string(),
  regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/),
  check((value) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    );
  }, "Invalid calendar date"),
  transform((value) => new Date(value)),
  check((date) => !Number.isNaN(date.getTime()), "Invalid timestamp"),
);
//#endregion
//#region ../../packages/core/src/schemas/management.ts
var rounding = pipe(number(), safeInteger(), minValue(1));
var storeInput = strictObject({
  name,
  cashRoundingStep: optional(rounding),
});
var storePatch = strictObject({
  name: optional(name),
  cashRoundingStep: optional(rounding),
});
var branchInput = strictObject({
  name,
  storeId: uuidV7Schema,
});
var branchPatch = strictObject({
  name: optional(name),
  storeId: optional(uuidV7Schema),
});
//#endregion
//#region ../../packages/core/src/schemas/events.ts
var envelope = object({ v: pipe(number(), integer$1(), minValue(1)) });
function createEventDecoder(currentVersion, read, upcasters = {}) {
  return (raw) => {
    let version = parse(envelope, raw).v;
    if (version > currentVersion) throw new Error("Unsupported event version");
    while (version < currentVersion) {
      const upcast = upcasters[version];
      if (!upcast) throw new Error("Unsupported event version");
      raw = upcast(raw);
      if (parse(envelope, raw).v !== version + 1)
        throw new Error("An upcaster must advance exactly one event version");
      version += 1;
    }
    return read(raw);
  };
}
//#endregion
//#region ../../packages/core/src/schemas/till/fields.ts
var tillId = pipe(
  uuidV7Schema,
  transform((value) => value.toLowerCase()),
);
//#endregion
//#region ../../packages/core/src/schemas/till/sale.ts
var amount = pipe(number(), safeInteger(), transform(money));
var nonnegative = pipe(number(), safeInteger(), minValue(0), transform(money));
var saleTotals = strictObject({
  base: amount,
  vat: amount,
  nhil: amount,
  getfund: amount,
  covid: amount,
  gross: amount,
  roundingAdjustment: amount,
});
var saleTaxSnapshot = strictObject({
  ...saleTotals.entries,
  rule: strictObject({
    ...taxRuleSchema.entries,
    id: tillId,
  }),
  on: dateSchema,
  taxClass: taxClassSchema,
  priceMode: picklist(["inclusive", "exclusive"]),
  quantityThousandths: pipe(number(), safeInteger(), minValue(1)),
  unitPrice: nonnegative,
  discount: nonnegative,
});
var saleSnapshotV1 = strictObject({
  id: tillId,
  localId: tillId,
  orgId: tillId,
  deviceId: tillId,
  storeId: tillId,
  branchId: tillId,
  cashierId: tillId,
  sessionId: tillId,
  appVersion: pipe(string(), minLength(1)),
  deviceTime: pipe(string(), isoTimestamp()),
  lines: pipe(
    array(
      strictObject({
        id: tillId,
        productId: tillId,
        priceId: tillId,
        sku: string(),
        name: string(),
        baseUnit: picklist(["each", "kg", "g", "l", "ml"]),
        tax: saleTaxSnapshot,
      }),
    ),
    minLength(1),
  ),
  totals: saleTotals,
});
var saleSnapshot = strictObject({
  ...saleSnapshotV1.entries,
  receiptNumber: nullable(pipe(string(), regex(/^BR[0-9]+-T[0-9]+-X?[0-9]{6,}$/))),
  receiptOverflow: boolean(),
  clockOffsetMs: pipe(number(), safeInteger()),
});
var saleEvent = strictObject({
  v: literal(2),
  type: literal("sale.recorded"),
  sale: saleSnapshot,
});
strictObject({
  lines: pipe(
    array(
      strictObject({
        productId: tillId,
        quantityThousandths: pipe(number(), safeInteger(), minValue(1)),
      }),
    ),
    minLength(1),
  ),
});
var saleEventV1 = strictObject({
  v: literal(1),
  type: literal("sale.recorded"),
  sale: saleSnapshotV1,
});
var decodeSaleEvent = createEventDecoder(2, (raw) => parse(saleEvent, raw), {
  1(raw) {
    const old = parse(saleEventV1, raw);
    return {
      ...old,
      v: 2,
      sale: {
        ...old.sale,
        receiptNumber: null,
        receiptOverflow: false,
        clockOffsetMs: 0,
      },
    };
  },
});
strictObject({
  id: tillId,
  orgId: tillId,
  deviceId: tillId,
  branchId: tillId,
  userId: tillId,
  roleName: string(),
  issuedAt: pipe(string(), isoTimestamp()),
  expiresAt: pipe(string(), isoTimestamp()),
  permissions: array(string()),
  proof: pipe(string(), minLength(1)),
});
//#endregion
//#region ../../packages/core/src/schemas/catalogue/mappings.ts
var digit = pipe(number(), safeInteger());
var slice = strictObject({
  start: pipe(digit, minValue(2), maxValue(11)),
  length: pipe(digit, minValue(1), maxValue(10)),
});
var fields = {
  prefix: pipe(digit, minValue(20), maxValue(29)),
  product: slice,
  value: slice,
  decimals: pipe(digit, minValue(0), maxValue(4)),
};
var end = (s) => s.start + s.length;
var fits = (s) => end(s) <= 12;
/** EAN-13 digits 2..11 carry the data; the product and value slices must fit and not overlap. */
var mappingInput = pipe(
  variant("kind", [
    strictObject({
      ...fields,
      kind: literal("weight"),
      unit: picklist(["g", "kg"]),
    }),
    strictObject({
      ...fields,
      kind: literal("price"),
    }),
  ]),
  check((m) => fits(m.product) && fits(m.value), "Slices must end by digit 11"),
  check(
    (m) => end(m.product) <= m.value.start || end(m.value) <= m.product.start,
    "Product and value digits overlap",
  ),
);
var mappingPatch = partial(
  strictObject({
    ...fields,
    kind: picklist(["weight", "price"]),
    unit: picklist(["g", "kg"]),
  }),
);
//#endregion
//#region ../../packages/core/src/schemas/till/reference.ts
var timestamp = pipe(string(), isoTimestamp());
var productFields$1 = {
  id: tillId,
  orgId: tillId,
  sku: string(),
  name: string(),
  baseUnit: picklist(["each", "kg", "g", "l", "ml"]),
  taxClass: taxClassSchema,
  archivedAt: nullable(timestamp),
};
var tillProductBase = object(productFields$1);
var barcodes = array(
  strictObject({
    code: string(),
    quantityThousandths: pipe(number(), safeInteger(), minValue(1)),
  }),
);
var tillProduct = strictObject({
  ...productFields$1,
  barcodes,
});
var tillPrice = strictObject({
  id: tillId,
  orgId: tillId,
  productId: tillId,
  branchId: nullable(tillId),
  amount: pipe(number(), safeInteger(), minValue(0), transform(money)),
  validFrom: timestamp,
  validTo: nullable(timestamp),
});
var tillTaxRule = strictObject({
  ...taxRuleSchema.entries,
  id: tillId,
  orgId: tillId,
  source: string(),
});
var tillMapping = pipe(
  looseObject({ id: tillId }),
  rawTransform(({ dataset, addIssue, NEVER }) => {
    const { id, ...layout } = dataset.value;
    const parsed = safeParse(mappingInput, layout);
    if (parsed.success)
      return {
        id,
        ...parsed.output,
      };
    addIssue({ message: "Invalid barcode mapping" });
    return NEVER;
  }),
);
/** Startup provisioning accepts v1 products (no barcodes) and v2 products; barcodes default to none. */
var tillReference = strictObject({
  products: array(
    strictObject({
      ...productFields$1,
      barcodes: optional(barcodes, []),
    }),
  ),
  prices: array(tillPrice),
  taxRules: array(tillTaxRule),
  barcodeMappings: optional(array(tillMapping), []),
});
var tillReferenceV2 = strictObject({
  products: array(tillProduct),
  prices: array(tillPrice),
  taxRules: array(tillTaxRule),
  barcodeMappings: array(tillMapping),
});
var payloads = {
  product: tillProduct,
  price: tillPrice,
  "tax-rule": tillTaxRule,
  "barcode-mapping": tillMapping,
};
var remove = object({ id: tillId });
pipe(
  looseObject({
    seq: sequenceSchema,
    entityId: string(),
    entity: picklist(Object.keys(payloads)),
    op: picklist(["upsert", "delete"]),
    v: literal(2),
  }),
  rawTransform(({ dataset, addIssue, NEVER }) => {
    const change = dataset.value;
    const schema = change.op === "delete" ? remove : payloads[change.entity];
    const parsed = safeParse(schema, change.payload);
    if (parsed.success)
      return {
        ...change,
        payload: parsed.output,
      };
    addIssue({ message: "Invalid reference change payload" });
    return NEVER;
  }),
);
object({
  v: literal(2),
  orgId: tillId,
  storeId: tillId,
  cursor: sequenceSchema,
  reference: tillReferenceV2,
});
//#endregion
//#region ../../packages/core/src/schemas/till/config.ts
var tillReceiptCodes = strictObject({
  branchCode: pipe(string(), regex(/^BR[0-9]+$/)),
  deviceCode: pipe(string(), regex(/^T[0-9]+$/)),
});
object({
  orgId: tillId,
  deviceId: tillId,
  storeId: tillId,
  branchId: tillId,
  appVersion: pipe(string(), minLength(1)),
  receiptCodes: optional(tillReceiptCodes),
});
//#endregion
//#region ../../packages/core/src/schemas/catalogue/inputs.ts
var barcodeInput = strictObject({
  code: text(64),
  quantityThousandths: optional(positiveInt, 1e3),
});
var productFields = {
  sku: text(64),
  name,
  baseUnit: picklist(["each", "kg", "g", "l", "ml"]),
  taxClass: picklist(["standard", "zero-rated", "exempt"]),
  categoryId: nullable(uuidV7Schema),
  supplierId: nullable(uuidV7Schema),
  onlineVisible: boolean(),
};
var productInput = strictObject({
  ...productFields,
  categoryId: optional(productFields.categoryId),
  supplierId: optional(productFields.supplierId),
  onlineVisible: optional(productFields.onlineVisible, false),
  barcodes: optional(array(barcodeInput), []),
});
var productPatch = partial(strictObject(productFields));
var listQuery = object({
  q: optional(text(100)),
  categoryId: optional(uuidV7Schema),
  cursor: optional(uuidV7Schema),
  limit: optional(
    pipe(string(), transform(Number), safeInteger(), minValue(1), maxValue(200)),
    "50",
  ),
});
var priceInput = strictObject({
  amount: pipe(number(), safeInteger(), minValue(1)),
  branchId: optional(uuidV7Schema),
  validFrom: optional(timestamp$1),
});
var lookupQuery = object({
  branchId: optional(uuidV7Schema),
  at: optional(timestamp$1),
});
var priceAtQuery = object({
  ...lookupQuery.entries,
  productId: uuidV7Schema,
});
var contact = optional(nullable(pipe(string(), trim(), maxLength(200))));
var categoryInput = strictObject({
  name,
  parentId: optional(nullable(uuidV7Schema)),
});
var supplierInput = strictObject({
  name,
  phone: contact,
  email: contact,
  tin: contact,
});
object({
  orgId: uuidV7Schema,
  priceId: uuidV7Schema,
  actorId: optional(uuidV7Schema),
  startsAt: timestamp$1,
  endsAt: timestamp$1,
});
var scheduleInput = pipe(
  strictObject({
    amount: pipe(number(), safeInteger(), minValue(1)),
    branchId: optional(uuidV7Schema),
    startsAt: timestamp$1,
    endsAt: timestamp$1,
  }),
  check((data) => data.endsAt > data.startsAt, "endsAt must be after startsAt"),
  check((data) => data.endsAt.getTime() > Date.now(), "endsAt must be in the future"),
);
var categoryUpdate = partial(categoryInput);
var supplierUpdate = partial(supplierInput);
//#endregion
export {
  ghana2026 as A,
  tillId as C,
  storePatch as D,
  storeInput as E,
  add as F,
  fromBigInt as I,
  money as L,
  formatGHS as M,
  fromDecimal as N,
  snapshotAmount as O,
  toDecimal as P,
  mulRatio as R,
  saleTotals as S,
  branchPatch as T,
  mappingInput as _,
  lookupQuery as a,
  saleEvent as b,
  productInput as c,
  supplierInput as d,
  supplierUpdate as f,
  tillTaxRule as g,
  tillReference as h,
  listQuery as i,
  dateSchema as j,
  snapshotLine as k,
  productPatch as l,
  tillProductBase as m,
  categoryInput as n,
  priceAtQuery as o,
  tillPrice as p,
  categoryUpdate as r,
  priceInput as s,
  barcodeInput as t,
  scheduleInput as u,
  mappingPatch as v,
  branchInput as w,
  saleSnapshot as x,
  decodeSaleEvent as y,
};

import { v7 } from "uuid";
import { TILL_BODIES } from "./till";

/**
 * A schema-valid body for each write route whose input an id-only body cannot pass, with the other shop's id in
 * every reference it takes. Validation then lets the request through, so the tenant check is what has to refuse it.
 * What a request creates gets a fresh id of its own: A never ends up holding one of B's ids.
 */
export const BODIES: Record<string, (id: string, own: Session) => unknown> = {
  "PATCH /catalogue/barcodes/mappings/:id": () => ({ decimals: 2 }),
  "PATCH /categories/:id": (id) => ({ name: "Sweep", parentId: id }),
  "PATCH /customers/:id": () => ({ name: "Sweep" }),
  "PATCH /loyalty/tiers/:id": () => ({ name: "Sweep" }),
  "PATCH /products/:id": (id) => ({ name: "Sweep", categoryId: id, supplierId: id }),
  "PATCH /roles/:id": () => ({ name: "Sweep" }),
  "PATCH /suppliers/:id": () => ({ name: "Sweep" }),
  "PATCH /users/:id/role": (id) => ({ roleId: id }),
  "POST /branches": (id) => ({ name: "Sweep", storeId: id }),
  "POST /cashiers/login": (id) => ({
    deviceId: id,
    deviceToken: "0".repeat(64),
    userId: id,
    pin: "2468",
  }),
  "POST /cashiers/pin": (id) => ({ userId: id, pin: "135790" }),
  "POST /cashiers/unlock": (id) => ({
    deviceId: id,
    deviceToken: "0".repeat(64),
    email: "owner-b@tenants.test",
    approverId: id,
    pin: "2468",
  }),
  "POST /catalogue/barcodes/mappings": () => ({
    kind: "price",
    prefix: 22,
    product: { start: 2, length: 5 },
    value: { start: 7, length: 5 },
    decimals: 2,
  }),
  "POST /catalogue/imports": (id) => ({ assetId: id }),
  "POST /categories": (id) => ({ name: "Sweep", parentId: id }),
  "POST /customers": () => ({ id: v7(), name: "Sweep", phone: "0244000999" }),
  "POST /customers/:id/credit/notes": () => ({ amount: 10_000, reason: "Sweep" }),
  "POST /customers/:id/merge": (id) => ({ loserId: id }),
  "POST /customers/:id/payments": () => ({ id: v7(), amount: 10_000, method: "cash" }),
  "POST /customers/:id/statement/links": () => ({ from: "2026-01-01", to: "2026-01-31" }),
  "POST /customers/:id/statements": () => ({
    channel: "sms",
    from: "2026-01-01",
    to: "2026-01-31",
  }),
  "POST /devices/enroll": (id) => ({ orgId: id, code: "123456", name: "Sweep" }),
  "POST /devices/enrollment": (id) => ({ branchId: id }),
  "POST /devices/revoke": (id) => ({ deviceId: id }),
  "POST /loyalty/tiers": () => ({ name: "Sweep", minSpend: 0, earnBps: 100 }),
  "POST /loyalty/transfers": (id) => ({ fromId: id, toId: id, points: 1, reason: "Sweep" }),
  "POST /products": (id) => ({
    sku: `SWEEP-${id.slice(-8)}`,
    name: "Sweep",
    baseUnit: "each",
    taxClass: "standard",
    categoryId: id,
    supplierId: id,
  }),
  "POST /products/:id/barcodes": () => ({ code: "6009900099999" }),
  "POST /products/:id/prices": (id) => ({ amount: 10_000, branchId: id, reason: "Sweep" }),
  "POST /roles": () => ({ name: "Sweep", permissionCodes: [] }),
  "POST /stock/adjustments": (id) => ({
    id: v7(),
    branchId: id,
    cause: "damaged",
    lines: [{ productId: id, quantityThousandths: 1000 }],
  }),
  "POST /stock/receipts": (id) => ({
    id: v7(),
    branchId: id,
    supplierId: id,
    lines: [{ productId: id, quantityThousandths: 1000, unitCost: 1000 }],
  }),
  "POST /stock/takes": (id) => ({ id: v7(), branchId: id, scope: "category", categoryId: id }),
  "POST /stores": () => ({ name: "Sweep" }),
  "POST /suppliers": () => ({ name: "Sweep" }),
  "POST /transactions/:id/receipt/email": () => ({ requestKey: v7(), email: "sweep@tenants.test" }),
  "PUT /customers/:id/limit": () => ({ creditLimit: 100_000 }),
  "PUT /settings/credit": () => ({ termsDays: 30, interestBps: 0 }),
  "PUT /settings/kyc": () => ({ idRequired: false, idTypes: ["ghana_card"] }),
  "PUT /settings/loyalty": () => ({
    enabled: false,
    earnBps: 100,
    pointValue: 100,
    expiryDays: 0,
    tierNoticeDays: 0,
  }),
  "PUT /settings/payments": () => ({ momoProvider: "paystack" }),
  "PUT /settings/statements": () => ({ schedule: "off", day: 1, channels: [], minBalance: 0 }),
  "PUT /settings/tax": () => ({
    tin: null,
    vatRegisteredFrom: null,
    priceMode: "inclusive",
    cashRounding: "10p",
  }),
  "PUT /stock/reorder": (id) => ({ branchId: id, productId: id, levelThousandths: 1000 }),
  "PUT /tax/returns/:period/input": () => ({ vat: 0, nhil: 0, getfund: 0 }),
  "PUT /kyb": () => ({ businessName: "Sweep" }),
  "POST /products/:id/prices/schedule": (id) => ({
    amount: 10_000,
    branchId: id,
    startsAt: "2030-01-01T00:00:00.000Z",
    endsAt: "2030-01-02T00:00:00.000Z",
    reason: "Sweep",
  }),
  "POST /approvals": (id) => ({ kind: "refund", saleId: id, amount: 10_000, reason: "Sweep" }),
  "POST /invitations": (id) => ({ email: "sweep@tenants.test", roleId: id, channel: "local" }),
  "POST /invitations/:id/accept": () => ({
    token: "sweep-token",
    name: "Sweep",
    password: "Sweep-password-1",
  }),
  "POST /kyc": (id) => ({ purpose: "credit", subject: { customerId: id }, requestedLimit: 10_000 }),
  "POST /kyc/:id/decision": (id) => ({ approve: true, limit: 10_000, roleId: id, note: "Sweep" }),
  "POST /kyc/:id/id": () => ({
    idType: "ghana_card",
    idNumber: "GHA-123456789-0",
    fullName: "Sweep",
  }),
  "POST /kyc/:id/verify": () => ({ code: "123456" }),
  ...TILL_BODIES,
  "POST /catalogue/imports/uploads": () => ({
    fileName: "sweep.csv",
    contentType: "text/csv",
    sizeBytes: 1,
    sha256: "0".repeat(64),
  }),
  "POST /kyb/documents": () => ({
    fileName: "sweep.pdf",
    contentType: "application/pdf",
    sizeBytes: 1,
    sha256: "0".repeat(64),
  }),
  "POST /payments/momo": () => ({
    reference: v7(),
    amount: 1000,
    phone: "0244000999",
    network: "mtn",
  }),
  "PUT /users/:id/branches": (id) => ({ branchIds: [id] }),
};

export type Session = {
  sessionId: string;
  proof: string;
  orgId: string;
  userId: string;
  deviceId: string;
  storeId: string;
  branchId: string;
};

/**
 * Write routes whose cross-shop refusal another suite proves with a real till event, by the test that proves it.
 * A sale is a full basket with tax and tenders; its suite pushes one naming another shop's product.
 */
export const ELSEWHERE: Record<string, { file: string; test: string }> = {
  "POST /sync/push": {
    file: "tests/integration/sync/authentication.test.ts",
    test: "cross-tenant product references are rejected",
  },
  "POST /sync/shifts": {
    file: "tests/integration/sync/shifts/accept.test.ts",
    test: "a shift for another organisation is outside the enrolled scope",
  },
};
/** Registration comes before any shop exists: its ids belong to no org, so there is nothing of B's to reach. */
export const PRE_SHOP = [
  "POST /onboarding/start",
  "POST /onboarding/verify",
  "POST /onboarding/complete",
  "POST /onboarding/:id/resend",
];

/** Path parameters that are not ids: the sweep fills them with a valid value instead of the other shop's id. */
export const PARAMS: Record<string, string> = { period: "2026-01" };

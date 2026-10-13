import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { canonicalJson } from "@shopper/audit";
import { defineCommand } from "@shopper/audit/sqlite";
import {
  hostSession,
  localSale,
  outbox,
  reference,
  saleLine,
  tillState,
  type TillDatabase,
} from "@shopper/db-sqlite";
import { add } from "@shopper/money";
import { snapshotLine } from "@shopper/tax";
import { recordSaleInput, saleEvent, saleTotals } from "../schemas/till/sale";
import { tillPrice, tillProduct, tillTaxRule } from "../schemas/till/reference";
import { tillSession, type TillSession } from "../schemas/till/session";
import { TillError } from "./error";
import { tillConfiguration } from "../schemas/till/config";
import type { TillConfig } from "./types";

export async function recordLocalSale(
  db: TillDatabase,
  config: TillConfig,
  rawSession: unknown,
  input: unknown,
) {
  config = { ...v.parse(tillConfiguration, config), now: config.now };
  const session = v.parse(tillSession, rawSession);
  const data = v.parse(recordSaleInput, input);
  const time = config.now?.() ?? new Date();
  if (
    session.orgId !== config.orgId ||
    session.deviceId !== config.deviceId ||
    session.branchId !== config.branchId
  )
    throw new TillError(
      "scope",
      "Cashier session is outside the configured tenant/device/branch scope",
    );
  if (!session.permissions.includes("sale.create"))
    throw new TillError("permission", "Session lacks sale.create permission");
  if (
    !Number.isFinite(time.valueOf()) ||
    time < new Date(session.issuedAt) ||
    time >= new Date(session.expiresAt)
  )
    throw new TillError("session", "Cashier session is expired or not yet valid");
  return record(
    db,
    {
      orgId: config.orgId,
      deviceId: config.deviceId,
      branchId: config.branchId,
      actorId: session.userId,
      role: session.roleName,
      appVersion: config.appVersion,
      deviceTime: time,
    },
    { config, session, data, time },
  );
}

const record = defineCommand({
  name: "sale.record-local",
  async run(
    tx,
    context,
    input: {
      config: TillConfig;
      session: TillSession;
      data: v.InferOutput<typeof recordSaleInput>;
      time: Date;
    },
  ) {
    const { config, session, data, time } = input;
    const references = await tx.select().from(reference).where(eq(reference.orgId, context.orgId));
    const products = references
      .filter((row) => row.entity === "product")
      .map((row) => v.parse(tillProduct, row.payload));
    const prices = references
      .filter((row) => row.entity === "price")
      .map((row) => v.parse(tillPrice, row.payload));
    const on = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Accra",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(time);
    const rule = references
      .filter((row) => row.entity === "tax-rule")
      .map((row) => v.parse(tillTaxRule, row.payload))
      .filter((row) => row.effectiveFrom <= on)
      .sort(
        (a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.id.localeCompare(a.id),
      )[0];
    if (!rule) throw new TillError("reference", "No effective tax reference for this sale date");
    const lines = data.lines.map((line) => {
      const product = products.find((row) => row.id === line.productId && row.archivedAt === null);
      if (!product)
        throw new TillError("reference", "Active product reference not found in tenant");
      const price = prices
        .filter(
          (row) =>
            row.productId === product.id &&
            (row.branchId === config.branchId || row.branchId === null) &&
            new Date(row.validFrom) <= time &&
            (row.validTo === null || new Date(row.validTo) > time),
        )
        .sort(
          (a, b) =>
            Number(b.branchId !== null) - Number(a.branchId !== null) ||
            new Date(b.validFrom).valueOf() - new Date(a.validFrom).valueOf() ||
            b.id.localeCompare(a.id),
        )[0];
      if (!price) throw new TillError("reference", "Effective price reference not found");
      return {
        id: v7(),
        productId: product.id,
        priceId: price.id,
        sku: product.sku,
        name: product.name,
        baseUnit: product.baseUnit,
        tax: snapshotLine({
          rule,
          on,
          taxClass: product.taxClass,
          priceMode: "inclusive",
          unitPrice: price.amount,
          quantityThousandths: line.quantityThousandths,
        }),
      };
    });
    const totals = v.parse(saleTotals, {
      base: 0,
      vat: 0,
      nhil: 0,
      getfund: 0,
      covid: 0,
      gross: 0,
      roundingAdjustment: 0,
    });
    for (const line of lines) {
      for (const key of Object.keys(totals) as (keyof typeof totals)[])
        totals[key] = add(totals[key], line.tax[key]);
    }
    const id = v7();
    const event = v.parse(saleEvent, {
      v: 1,
      type: "sale.recorded",
      sale: {
        id,
        localId: id,
        orgId: context.orgId,
        deviceId: context.deviceId,
        storeId: config.storeId,
        branchId: context.branchId,
        cashierId: context.actorId,
        sessionId: session.id,
        appVersion: config.appVersion,
        deviceTime: time.toISOString(),
        lines,
        totals,
      },
    });
    const [savedSession] = await tx
      .select()
      .from(hostSession)
      .where(eq(hostSession.id, session.id));
    if (savedSession && canonicalJson(savedSession) !== canonicalJson(session))
      throw new TillError("conflict", "Saved cashier session identity has different content");
    if (!savedSession) await tx.insert(hostSession).values(session);
    const [state] = await tx
      .select()
      .from(tillState)
      .where(and(eq(tillState.orgId, context.orgId), eq(tillState.deviceId, config.deviceId)));
    const localSeq = (state?.lastOutboxSeq ?? 0) + 1;
    if (!Number.isSafeInteger(localSeq))
      throw new TillError("counter", "Local ordering counter exhausted");
    await tx
      .insert(tillState)
      .values({
        id: state?.id ?? v7(),
        orgId: context.orgId,
        deviceId: config.deviceId,
        lastOutboxSeq: localSeq,
      })
      .onConflictDoUpdate({
        target: [tillState.orgId, tillState.deviceId],
        set: { lastOutboxSeq: localSeq },
      });
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonicalJson(event.sale)),
    );
    const contentHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    await tx.insert(localSale).values({
      id,
      orgId: context.orgId,
      deviceId: config.deviceId,
      localId: id,
      payload: event.sale,
      contentHash,
    });
    for (const line of event.sale.lines)
      await tx
        .insert(saleLine)
        .values({ id: line.id, orgId: context.orgId, saleId: id, payload: line });
    await tx.insert(outbox).values({
      id: v7(),
      orgId: context.orgId,
      deviceId: config.deviceId,
      localId: id,
      localSeq,
      event,
    });
    return event;
  },
  audit: (_input, output) => ({ saleId: output.sale.id, lineCount: output.sale.lines.length }),
  details: (_input, output) => ({ entity: "sale", entityId: output.sale.id }),
});

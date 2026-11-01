import { and, asc, desc, eq, ne } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import {
  shopAccount,
  shopAddress,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import * as v from "valibot";
import { readShopAccount } from "./account";
import { ShopError, parseShop } from "./error";
import { shopAddressInput, shopAddressPatch, shopProfileInput } from "./schemas/account";
import type { ShopSession } from "./types";

type Address = typeof shopAddress.$inferSelect;
type Saved = v.InferOutput<typeof shopAddressPatch>;

/** Edits the shopper's own name and email; the till's customer record keeps what staff entered. */
export async function saveShopProfile(
  db: ShopperDatabase,
  appVersion: string,
  session: ShopSession,
  raw: unknown,
) {
  const input = parseShop(shopProfileInput, raw);
  await saveProfile(
    db,
    { orgId: session.orgId, appVersion },
    { accountId: session.accountId, ...input },
  );
  return readShopAccount(db, session);
}

/** Their delivery addresses, the default first. */
export async function listShopAddresses(db: ShopperDatabase, session: ShopSession) {
  const rows = await db
    .select()
    .from(shopAddress)
    .where(and(eq(shopAddress.orgId, session.orgId), eq(shopAddress.accountId, session.accountId)))
    .orderBy(desc(shopAddress.isDefault), asc(shopAddress.id));
  return { items: rows.map(addressView) };
}

/** Adds an address (no id) or changes one of theirs; making it the default takes the default from the others. */
export async function saveShopAddress(
  db: ShopperDatabase,
  appVersion: string,
  session: ShopSession,
  raw: unknown,
  rawId?: unknown,
) {
  const id = rawId === undefined ? undefined : ownId(rawId);
  const data = id ? parseShop(shopAddressPatch, raw) : parseShop(shopAddressInput, raw);
  const saved = await saveAddress(
    db,
    { orgId: session.orgId, appVersion },
    { accountId: session.accountId, id, data },
  );
  return addressView(saved);
}

/** Removes one of their addresses; when it was the default, the oldest one left takes over. */
export async function deleteShopAddress(
  db: ShopperDatabase,
  appVersion: string,
  session: ShopSession,
  rawId: unknown,
) {
  await deleteAddress(
    db,
    { orgId: session.orgId, appVersion },
    { accountId: session.accountId, id: ownId(rawId) },
  );
}

const saveProfile = defineCommand({
  name: "shop.profile.save",
  async run(
    tx,
    context,
    input: { accountId: string; name?: string | null; email?: string | null },
  ) {
    await tx
      .update(shopAccount)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        updatedAt: new Date(),
      })
      .where(and(eq(shopAccount.orgId, context.orgId), eq(shopAccount.id, input.accountId)));
    return {
      accountId: input.accountId,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.email !== undefined && { email: input.email }),
    };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "shop_account", entityId: output.accountId }),
});

const saveAddress = defineCommand({
  name: "shop.address.save",
  async run(tx, context, input: { accountId: string; id?: string; data: Saved }) {
    const others = await addressesOf(tx, context.orgId, input.accountId);
    const current = input.id ? others.find((row) => row.id === input.id) : undefined;
    if (input.id && !current) throw new ShopError("We could not find that address", 404);
    // The first address is the default whether or not they said so.
    const alone = others.every((row) => row.id === input.id);
    const isDefault = alone || (input.data.isDefault ?? current?.isDefault ?? false);
    const id = input.id ?? v7();
    if (isDefault)
      await tx
        .update(shopAddress)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(shopAddress.orgId, context.orgId),
            eq(shopAddress.accountId, input.accountId),
            ne(shopAddress.id, id),
          ),
        );
    const values = { ...input.data, isDefault, updatedAt: new Date() };
    const [saved] = current
      ? await tx
          .update(shopAddress)
          .set(values)
          .where(and(eq(shopAddress.orgId, context.orgId), eq(shopAddress.id, id)))
          .returning()
      : await tx
          .insert(shopAddress)
          .values({
            ...(values as Required<Saved>),
            id,
            orgId: context.orgId,
            accountId: input.accountId,
          })
          .returning();
    return saved!;
  },
  audit: (_input, output) => ({
    addressId: output.id,
    accountId: output.accountId,
    label: output.label,
    phone: output.phone,
    isDefault: output.isDefault,
  }),
  details: (_input, output) => ({ entity: "shop_address", entityId: output.id }),
});

const deleteAddress = defineCommand({
  name: "shop.address.delete",
  async run(tx, context, input: { accountId: string; id: string }) {
    const rows = await addressesOf(tx, context.orgId, input.accountId);
    const gone = rows.find((row) => row.id === input.id);
    if (!gone) throw new ShopError("We could not find that address", 404);
    await tx
      .delete(shopAddress)
      .where(and(eq(shopAddress.orgId, context.orgId), eq(shopAddress.id, gone.id)));
    const heir = gone.isDefault ? rows.find((row) => row.id !== gone.id) : undefined;
    if (heir)
      await tx
        .update(shopAddress)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(and(eq(shopAddress.orgId, context.orgId), eq(shopAddress.id, heir.id)));
    return { addressId: gone.id, accountId: input.accountId, defaultId: heir?.id ?? null };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "shop_address", entityId: output.addressId }),
});

/** The account's addresses, oldest first, locked so two saves cannot both keep a default. */
function addressesOf(tx: ShopperTransaction, orgId: string, accountId: string) {
  return tx
    .select()
    .from(shopAddress)
    .where(and(eq(shopAddress.orgId, orgId), eq(shopAddress.accountId, accountId)))
    .orderBy(asc(shopAddress.id))
    .for("update");
}

function ownId(raw: unknown) {
  const id = v.safeParse(uuidV7Schema, raw);
  if (!id.success) throw new ShopError("We could not find that address", 404);
  return id.output;
}

function addressView(row: Address) {
  return {
    id: row.id,
    label: row.label,
    line1: row.line1,
    area: row.area,
    city: row.city,
    landmark: row.landmark,
    phone: row.phone,
    isDefault: row.isDefault,
  };
}

import { and, eq } from "drizzle-orm";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import type { DBAdapter, BetterAuthOptions, Where } from "better-auth";
import { organization } from "better-auth/plugins/organization";
import { v7 } from "uuid";
import {
  account,
  invitation,
  member,
  org,
  role,
  session,
  user,
  verification,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";

/** Better Auth bound to one organization: every read and write is scoped to its org_id. */
export function buildAuth(
  database: ShopperDatabase | ShopperTransaction,
  orgId: string,
  secret: string,
  baseURL: string,
  readOnly = false,
) {
  return betterAuth({
    baseURL,
    basePath: "/api/auth",
    secret,
    database: (options: BetterAuthOptions) => tenantAdapter(database, orgId, options, readOnly),
    advanced: {
      database: { generateId: () => v7(), joins: false },
      ipAddress: { ipAddressHeaders: ["x-shopper-client-ip"] },
    },
    // serveRuntime budgets sign-in through the RateLimiter port, across every isolate and the box alike.
    rateLimit: { enabled: false },
    user: {
      additionalFields: {
        orgId: { type: "string", required: true, defaultValue: orgId, input: false },
      },
    },
    account: {
      additionalFields: {
        orgId: { type: "string", required: true, defaultValue: orgId, input: false },
      },
    },
    session: {
      disableSessionRefresh: true,
      deferSessionRefresh: true,
      additionalFields: {
        orgId: { type: "string", required: true, defaultValue: orgId, input: false },
      },
    },
    verification: {
      storeInDatabase: true,
      disableCleanup: true,
      additionalFields: {
        orgId: { type: "string", required: true, defaultValue: orgId, input: false },
      },
    },
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => ({ data: { ...newUser, orgId } }),
          after: async (newUser) => {
            const [superadmin] = await database
              .select({ id: role.id })
              .from(role)
              .where(and(eq(role.orgId, orgId), eq(role.protectedOwner, true)))
              .limit(1);
            if (!superadmin) throw new Error("Default roles have not been seeded");
            await database.insert(member).values({
              orgId,
              organizationId: orgId,
              userId: newUser.id,
              role: "owner",
              roleId: superadmin.id,
            });
          },
        },
      },
      session: {
        create: {
          before: async (newSession) => ({
            data: { ...newSession, orgId, activeOrganizationId: orgId },
          }),
        },
      },
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: false,
        schema: {
          organization: {
            additionalFields: {
              orgId: { type: "string", required: true, defaultValue: orgId, input: false },
            },
          },
          member: {
            additionalFields: {
              orgId: { type: "string", required: true, defaultValue: orgId, input: false },
              roleId: { type: "string", required: true, input: false },
            },
          },
          invitation: {
            additionalFields: {
              orgId: { type: "string", required: true, defaultValue: orgId, input: false },
            },
          },
        },
      }),
    ],
  });
}

const authModels = new Set([
  "user",
  "session",
  "account",
  "verification",
  "organization",
  "member",
  "invitation",
]);
const authSchema = { user, session, account, verification, organization: org, member, invitation };
function tenantAdapter(
  database: unknown,
  orgId: string,
  options: BetterAuthOptions,
  readOnly = false,
): DBAdapter {
  const adapter = drizzleAdapter(database as ShopperDatabase, {
    provider: "pg",
    schema: authSchema,
    transaction: false,
  })(options);
  const scoped = (model: string, where?: Where[]) =>
    authModels.has(model)
      ? [...(where ?? []), { field: "orgId", value: orgId } satisfies Where]
      : where;
  let scopedAdapter: DBAdapter;
  scopedAdapter = {
    ...adapter,
    transaction: (callback) => callback(scopedAdapter),
    create: (input) => {
      if (readOnly) throw new Error("Read-only auth request");
      if (input.model === "organization")
        throw new Error("Organizations are provisioned by Shopper");
      return adapter.create({ ...input, data: { ...input.data, orgId } });
    },
    findOne: (input) => adapter.findOne({ ...input, where: scoped(input.model, input.where)! }),
    findMany: (input) => adapter.findMany({ ...input, where: scoped(input.model, input.where) }),
    count: (input) => adapter.count({ ...input, where: scoped(input.model, input.where) }),
    update: async (input) => {
      if (readOnly) return null;
      const { orgId: _ignored, ...update } = input.update;
      return adapter.update({ ...input, where: scoped(input.model, input.where)!, update });
    },
    updateMany: async (input) => {
      if (readOnly) return 0;
      const { orgId: _ignored, ...update } = input.update;
      return adapter.updateMany({ ...input, where: scoped(input.model, input.where)!, update });
    },
    delete: (input) =>
      readOnly
        ? Promise.resolve()
        : adapter.delete({ ...input, where: scoped(input.model, input.where)! }),
    deleteMany: (input) =>
      readOnly
        ? Promise.resolve(0)
        : adapter.deleteMany({ ...input, where: scoped(input.model, input.where)! }),
    consumeOne: (input) =>
      readOnly
        ? Promise.resolve(null)
        : adapter.consumeOne({ ...input, where: scoped(input.model, input.where)! }),
    incrementOne: (input) =>
      readOnly
        ? Promise.resolve(null)
        : adapter.incrementOne({ ...input, where: scoped(input.model, input.where)! }),
  };
  return scopedAdapter;
}

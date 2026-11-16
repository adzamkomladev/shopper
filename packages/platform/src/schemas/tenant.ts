import * as v from "valibot";
import { billingView } from "@shopper/backoffice/kit";
import { kybStatuses } from "./platform";

const when = v.nullable(v.string());

export const TENANT_TABS = [
  "overview",
  "stores",
  "products",
  "staff",
  "verification",
  "billing",
  "activity",
] as const;

/** The detail page's tab, kept in the address. */
export const tenantSearch = v.object({
  tab: v.optional(v.picklist(TENANT_TABS), "overview"),
});

const register = v.object({
  id: v.string(),
  name: v.string(),
  code: v.string(),
  createdAt: v.string(),
  revoked: v.boolean(),
  lastSeenAt: when,
});

/** One shop as staff debugging it see it; every list is bounded by the API. */
export const tenantDetail = v.object({
  overview: v.object({
    id: v.string(),
    name: v.string(),
    code: v.nullable(v.string()),
    mode: v.picklist(["full", "relay"]),
    updateChannel: v.picklist(["pilot", "stable"]),
    createdAt: v.string(),
    onboarding: v.nullable(v.picklist(["setup", "trading"])),
    firstSaleAt: when,
    owner: v.nullable(v.object({ name: v.string(), email: v.string() })),
    counts: v.object({
      stores: v.number(),
      branches: v.number(),
      devices: v.number(),
      products: v.number(),
      archived: v.number(),
      members: v.number(),
      invitations: v.number(),
    }),
  }),
  stores: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      opensAt: v.string(),
      closesAt: v.string(),
      branches: v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          code: v.string(),
          devices: v.array(register),
        }),
      ),
    }),
  ),
  products: v.object({
    active: v.number(),
    archived: v.number(),
    sample: v.array(
      v.object({
        id: v.string(),
        sku: v.string(),
        name: v.string(),
        onlineVisible: v.boolean(),
        archivedAt: when,
        updatedAt: v.string(),
      }),
    ),
  }),
  staff: v.object({
    members: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        email: v.string(),
        role: v.string(),
        owner: v.boolean(),
        active: v.boolean(),
        createdAt: v.string(),
      }),
    ),
    invitations: v.array(
      v.object({
        id: v.string(),
        email: v.string(),
        role: v.nullable(v.string()),
        status: v.string(),
        channel: v.string(),
        expiresAt: v.string(),
        createdAt: v.string(),
      }),
    ),
  }),
  verification: v.object({
    kyb: v.nullable(
      v.object({
        status: v.picklist(kybStatuses),
        version: v.number(),
        businessName: v.nullable(v.string()),
        checks: v.array(
          v.object({ check: v.string(), ok: v.boolean(), reason: v.optional(v.string()) }),
        ),
        submittedAt: when,
        decidedAt: when,
        decisionNote: v.nullable(v.string()),
        expiresOn: when,
        payouts: v.boolean(),
      }),
    ),
    workflows: v.array(
      v.object({
        instanceId: v.string(),
        type: v.string(),
        status: v.string(),
        currentStep: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
      }),
    ),
  }),
  billing: billingView,
  activity: v.array(
    v.object({
      id: v.string(),
      command: v.string(),
      entity: v.nullable(v.string()),
      actor: v.nullable(v.string()),
      role: v.nullable(v.string()),
      reason: v.nullable(v.string()),
      at: v.string(),
    }),
  ),
});

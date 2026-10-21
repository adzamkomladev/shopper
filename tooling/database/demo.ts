import { eq } from "drizzle-orm";
import { mutateManagement } from "../../packages/core/src/management";
import { createVerifiedOwner } from "../../packages/auth/src/onboarding/owner";
import { registerOrganizationUser } from "../../packages/auth/src/users";
import { rolePermissions } from "../../packages/auth/src/roles/defaults";
import { org, role, type ShopperDatabase } from "../../packages/db/pg/src/index";
import { provisionOrg, provisioningContext } from "./seed";
import { seedStock } from "./stock";

export const SEED_PASSWORD = "Admin@12345";
export type Credential = { org: string; role: string; email: string };
const BRANCHES = ["Accra Central", "Osu", "Kumasi Adum"];

/** Distinct plus-address emails; N is random in 300–2000 and unique within the run. */
function emailPicker() {
  const used = new Set<number>();
  return () => {
    let n: number;
    do n = 300 + Math.floor(Math.random() * 1701);
    while (used.has(n));
    used.add(n);
    return `adzamkomla.dev+${n}@gmail.com`;
  };
}

/**
 * Adds a store with branches and one user per default role to the dev org, plus a second
 * small org. Everything goes through commands (audited). ponytail: devices are not enrolled;
 * enrolment needs a device keypair handshake, so the till is enrolled by hand.
 */
export async function seedDemo(db: ShopperDatabase, devOrgId: string) {
  const nextEmail = emailPicker();
  const credentials: Credential[] = [];
  const context = provisioningContext(devOrgId);
  const [{ slug: devSlug }] = await db
    .select({ slug: org.slug })
    .from(org)
    .where(eq(org.id, devOrgId));
  const store = await mutateManagement(db, context, {
    kind: "store",
    action: "create",
    data: { name: "Shopper development" },
  });
  const branchIds: string[] = [];
  for (const name of BRANCHES) {
    const branch = await mutateManagement(db, context, {
      kind: "branch",
      action: "create",
      data: { name, storeId: store.id },
    });
    branchIds.push(branch.id);
  }

  const ownerEmail = nextEmail();
  const owner = await createVerifiedOwner(db, context, {
    name: "Superadmin",
    email: ownerEmail,
    password: SEED_PASSWORD,
  });
  credentials.push({ org: devSlug, role: "superadmin", email: ownerEmail });
  const roles = await db
    .select({ id: role.id, name: role.name })
    .from(role)
    .where(eq(role.orgId, devOrgId));
  const actor = { ...context, actorId: owner.userId, role: "superadmin" };
  await seedStock(db, actor, branchIds[0]!);
  for (const name of Object.keys(rolePermissions).filter((name) => name !== "superadmin")) {
    const email = nextEmail();
    await registerOrganizationUser(db, actor, {
      name: name[0]!.toUpperCase() + name.slice(1),
      email,
      password: SEED_PASSWORD,
      roleId: roles.find((row) => row.name === name)!.id,
    });
    credentials.push({ org: devSlug, role: name, email });
  }

  const second = provisioningContext();
  await provisionOrg(db, second, { name: "Shopper development two", slug: "dev-two" });
  const secondEmail = nextEmail();
  await createVerifiedOwner(db, second, {
    name: "Superadmin",
    email: secondEmail,
    password: SEED_PASSWORD,
  });
  credentials.push({ org: "dev-two", role: "superadmin", email: secondEmail });
  return credentials;
}

export function credentialsTable(credentials: Credential[], portal = "http://localhost:5173") {
  const lines = [
    `| Shop code | Role | Email | Password |`,
    `| --- | --- | --- | --- |`,
    ...credentials.map((c) => `| ${c.org} | ${c.role} | ${c.email} | ${SEED_PASSWORD} |`),
  ];
  return `Sign in at ${portal} with the shop code, email and password.\n\n${lines.join("\n")}\n`;
}

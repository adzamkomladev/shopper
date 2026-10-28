import { eq } from "drizzle-orm";
import * as v from "valibot";
import { kybCase, org, user } from "@shopper/db-pg";
import type { Delivery, WorkflowLauncher } from "@shopper/ports";
import { orgOwners } from "../audit/anchor";
import type { StatementDeliveryDeps } from "../customers";
import { kybId } from "./records";
import { kybNoticeMessage } from "./schemas/base";
import type { KybNotice } from "./types";

type Deps = Pick<StatementDeliveryDeps, "db" | "mail" | "baseUrl"> & { kyb?: WorkflowLauncher };

/** The notices that move the workflow on; starting a running instance only wakes it. */
const WAKES: readonly KybNotice[] = ["submitted", "approved", "rejected"];

const EMAILS: Partial<Record<KybNotice, { subject: string; body: string }>> = {
  checks_failed: {
    subject: "business verification needs attention",
    body: "Some details did not pass our checks. Open the verification page to see what to fix, then submit again.",
  },
  approved: {
    subject: "business verification approved",
    body: "Your business is verified. Mobile money taken on your tills is now paid out to your own account.",
  },
  rejected: {
    subject: "business verification not approved",
    body: "Shopper could not approve your business verification.",
  },
  renew: {
    subject: "renew your business verification",
    body: "A Ghana Card or business document on your verification expires within 30 days. Upload current ones and submit again.",
  },
  expired: {
    subject: "business verification lapsed",
    body: "A Ghana Card or business document on your verification has expired. Payouts continue for now; submit current documents to keep them.",
  },
};

/** Moves the shop's KYB workflow on, then tells every owner what changed and the way back to the form. */
export async function deliverKybNotice(deps: Deps, delivery: Delivery) {
  const notice = v.parse(kybNoticeMessage, delivery.message).payload.notice;
  const orgId = delivery.message.orgId;
  if (WAKES.includes(notice)) await deps.kyb?.start(kybId(orgId), { orgId });
  const email = EMAILS[notice];
  if (!email) return await delivery.ack();
  if (!deps.mail || !deps.baseUrl) return await delivery.retry();
  const [shop] = await deps.db
    .select({ name: org.name, note: kybCase.decisionNote })
    .from(org)
    .leftJoin(kybCase, eq(kybCase.orgId, org.id))
    .where(eq(org.id, orgId));
  const link = `${deps.baseUrl.replace(/\/$/, "")}/payments/verification`;
  const owners = await orgOwners(deps.db, orgId);
  for (const owner of owners) {
    const [row] = await deps.db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, owner.id));
    if (!row) continue;
    await deps.mail({
      email: row.email,
      subject: `${shop?.name ?? "Your shop"}: ${email.subject}`,
      link,
      plain: [
        email.body,
        ...(notice === "rejected" && shop?.note ? ["", `Reviewer's note: ${shop.note}`] : []),
        "",
        link,
      ].join("\n"),
      attachments: [],
    });
  }
  await delivery.ack();
}

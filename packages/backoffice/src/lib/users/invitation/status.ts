import type { Presentation } from "./types";
export type { Presentation } from "./types";
import type { InvitationView } from "../../../queries/users";

/** An invitation that is still pending past its expiry has lapsed, but the server only knows it as pending. */
export function present(invitation: InvitationView, now: number): Presentation {
  switch (invitation.status) {
    case "accepted":
      return { label: "Accepted", variant: "default", open: false };
    case "cancelled":
      return { label: "Cancelled", variant: "outline", open: false };
    case "expired":
      return { label: "Expired", variant: "outline", open: false };
    default:
      return Date.parse(invitation.expiresAt) <= now
        ? { label: "Expired", variant: "outline", open: true }
        : { label: "Pending", variant: "secondary", open: true };
  }
}

const DELIVERY: Record<string, string> = {
  sent: "Email sent",
  failed: "Email not delivered",
  pending: "Sending email…",
};

/** What happened to the email, for an emailed invitation that is still open. */
export const deliveryNote = (invitation: InvitationView) =>
  invitation.channel === "email" ? DELIVERY[invitation.deliveryStatus ?? "pending"] : undefined;

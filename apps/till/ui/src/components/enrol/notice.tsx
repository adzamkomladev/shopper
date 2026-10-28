import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import type { EnrolOutcome } from "../../enrol/types";

const refusals = {
  SHOP_NOT_FOUND: {
    title: "No shop has that code",
    detail: "Check the shop code beside the enrolment code in the portal, then try again.",
  },
  ENROL_REFUSED: {
    title: "That code didn't work",
    detail: "It is wrong, expired or already used. Create a new code in the portal.",
  },
  ENROL_LOCKED: {
    title: "Too many tries",
    detail: "Wait 15 minutes, then create a new code in the portal.",
  },
  OFFLINE: {
    title: "The server did not answer",
    detail: "Check this till's internet connection, then try again.",
  },
} as const;

/** The last attempt's outcome: what was refused and what to do about it, or the till being set up. */
export function EnrolNotice({ outcome }: { outcome: EnrolOutcome | null }) {
  if (!outcome) return null;
  if (outcome.kind === "enrolled")
    return (
      <Alert role="status">
        <CircleCheck aria-hidden="true" />
        <AlertTitle>
          {outcome.registerName} is set up for {outcome.shopName}
        </AlertTitle>
        <AlertDescription>Starting the till. Sign-in opens in a moment.</AlertDescription>
      </Alert>
    );
  return (
    <Alert role="alert" variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{refusals[outcome.code].title}</AlertTitle>
      <AlertDescription>{refusals[outcome.code].detail}</AlertDescription>
    </Alert>
  );
}

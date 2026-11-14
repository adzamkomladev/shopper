import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CloudUploadIcon, KeyRoundIcon, LockIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { formatDay } from "@shopper/utils";
import { billingStatusQuery } from "../../../queries/billing";

/**
 * Every member sees why changes are refused while an overdue invoice or a box's unconfirmed licence keeps the back
 * office read-only, a box moving to the cloud, and a box's warning in the 30 days before its licence locks.
 */
export function ReadOnlyBanner() {
  const { data } = useQuery(billingStatusQuery());
  const licence = data?.licence;
  if (data?.move)
    return (
      <Alert role="status">
        <CloudUploadIcon aria-hidden />
        <AlertDescription>
          <span>
            {data.move.status === "moved"
              ? `This shop has moved to the cloud at ${data.move.cloudUrl}, so this box only reads.`
              : "This shop is moving to the cloud, so the back office is read-only."}{" "}
            Tills keep selling.{" "}
            <Link to="/migration/move" className="font-medium underline underline-offset-4">
              See the move
            </Link>
          </span>
        </AlertDescription>
      </Alert>
    );
  if (licence?.state === "locked")
    return (
      <Alert variant="destructive" role="status">
        <LockIcon aria-hidden />
        <AlertDescription>
          <span>
            {licence.reason === "expired"
              ? "The licence has not checked in for 60 days, so the back office is read-only."
              : "This box has no valid licence, so the back office is read-only."}{" "}
            Tills keep selling. <BillingLink>See the licence</BillingLink>
          </span>
        </AlertDescription>
      </Alert>
    );
  if (licence?.state === "grace" && licence.locksAt)
    return (
      <Alert role="status">
        <KeyRoundIcon aria-hidden />
        <AlertDescription>
          <span>
            Check the licence in by {formatDay(licence.locksAt)}, or the back office turns
            read-only. <BillingLink>Check in</BillingLink>
          </span>
        </AlertDescription>
      </Alert>
    );
  if (!data?.readOnly) return null;
  return (
    <Alert variant="destructive" role="status">
      <LockIcon aria-hidden />
      <AlertDescription>
        <span>
          An invoice is overdue, so the back office is read-only. Tills keep selling.{" "}
          <BillingLink>Go to billing</BillingLink>
        </span>
      </AlertDescription>
    </Alert>
  );
}

function BillingLink({ children }: { children: string }) {
  return (
    <Link to="/billing" className="font-medium underline underline-offset-4">
      {children}
    </Link>
  );
}

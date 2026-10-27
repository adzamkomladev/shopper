import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LockIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { billingStatusQuery } from "../../../queries/billing";

/** Every member sees why changes are refused while an overdue invoice keeps the back office read-only. */
export function ReadOnlyBanner() {
  const { data } = useQuery(billingStatusQuery());
  if (!data?.readOnly) return null;
  return (
    <Alert variant="destructive" role="status">
      <LockIcon aria-hidden />
      <AlertDescription>
        <span>
          An invoice is overdue, so the back office is read-only. Tills keep selling.{" "}
          <Link to="/billing" className="font-medium underline underline-offset-4">
            Go to billing
          </Link>
        </span>
      </AlertDescription>
    </Alert>
  );
}

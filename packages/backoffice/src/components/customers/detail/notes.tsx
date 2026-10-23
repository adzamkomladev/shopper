import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GitMergeIcon, PhoneIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { customerQuery } from "../../../queries/customers/list";
import type { CustomerView } from "../../../queries/customers/types";

type SharedProps = {
  others: CustomerView[];
  /** Absent when the member cannot merge. */
  onMerge?: () => void;
};

/** Two active customers on one phone are usually one person entered twice: say so, and offer the merge. */
export function SharedPhoneNote({ others, onMerge }: SharedProps) {
  return (
    <Alert role="note">
      <PhoneIcon aria-hidden />
      <AlertTitle className="line-clamp-none">
        Shares a phone with {others.length} other {others.length === 1 ? "customer" : "customers"}
      </AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span>
          {others.map((other, index) => (
            <span key={other.id}>
              {index > 0 && ", "}
              <Link
                to="/customers/$customerId"
                params={{ customerId: other.id }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {other.name}
              </Link>
            </span>
          ))}
        </span>
        {onMerge && (
          <Button variant="outline" size="sm" onClick={onMerge}>
            <GitMergeIcon aria-hidden />
            Merge
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** A merged customer is archived for good and points at the customer that took their place. */
export function MergedNote({ intoId }: { intoId: string }) {
  const { data } = useQuery(customerQuery(intoId));
  return (
    <Alert role="note">
      <GitMergeIcon aria-hidden />
      <AlertTitle>
        Merged into{" "}
        <Link
          to="/customers/$customerId"
          params={{ customerId: intoId }}
          className="underline-offset-4 hover:underline"
        >
          {data?.name ?? "another customer"}
        </Link>
      </AlertTitle>
      <AlertDescription>
        Their account and points moved there. Past sales keep this name.
      </AlertDescription>
    </Alert>
  );
}

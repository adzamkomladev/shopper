import { BadgeCheckIcon, CircleAlertIcon, ClockIcon, InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { formatDate } from "../../lib/catalogue/detail/prices/groups";
import type { KybView } from "../../schemas/kyb";

/** Where the verification stands, and what the owner must do next. */
export function KybStatusNote({ view }: { view: KybView }) {
  const failed = view.checks.filter((check) => !check.ok);
  if (view.status === "submitted" || view.status === "in_review")
    return (
      <Alert role="status">
        <ClockIcon aria-hidden />
        <AlertTitle>With Shopper for review</AlertTitle>
        <AlertDescription>
          We check the details and documents, usually within one working day, and email you the
          decision. The form opens again if anything needs fixing.
        </AlertDescription>
      </Alert>
    );
  if (view.status === "approved")
    return (
      <Alert role="status">
        <BadgeCheckIcon aria-hidden />
        <AlertTitle>Verified for payouts</AlertTitle>
        <AlertDescription>
          Mobile money payments settle to your own account.{" "}
          {view.expiresOn
            ? `Renew before ${formatDate(view.expiresOn)}, when the first card or certificate expires.`
            : "Keep the details current."}
        </AlertDescription>
      </Alert>
    );
  if (view.status === "checks_failed" || view.status === "rejected" || view.status === "expired")
    return (
      <Alert variant="destructive" role="status">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>{TITLES[view.status]}</AlertTitle>
        <AlertDescription>
          {view.decisionNote && <p>{view.decisionNote}</p>}
          {failed.length > 0 && (
            <ul className="list-disc pl-4">
              {failed.map((check) => (
                <li key={check.check}>{check.reason}</li>
              ))}
            </ul>
          )}
          <p>Fix the details below and submit again.</p>
        </AlertDescription>
      </Alert>
    );
  return (
    <Alert role="status">
      <InfoIcon aria-hidden />
      <AlertTitle>Verify your business for payouts</AlertTitle>
      <AlertDescription>
        Shopper checks who runs the business, then mobile money payments settle straight to its own
        account. Selling does not wait for it.
      </AlertDescription>
    </Alert>
  );
}

const TITLES = {
  checks_failed: "Some checks did not pass",
  rejected: "Not verified",
  expired: "A document has expired",
};

/** What the server said when the last save or submission failed. */
export function SaveError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

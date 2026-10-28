import { useParams } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { OfflineNote } from "@shopper/backoffice/kit";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { DecisionPanel } from "../../../components/kyb/review/decision";
import {
  BusinessDetails,
  Checks,
  Evidence,
  ReviewHeader,
} from "../../../components/kyb/review/details";
import { kybCaseQuery } from "../../../queries/platform";

/** One shop's business verification: what it submitted, what the checks found, and the decision. */
export function KybReviewScreen() {
  const { orgId } = useParams({ from: "/_staff/kyb/$orgId" });
  const { data: kase } = useSuspenseQuery(kybCaseQuery(orgId));
  const online = useOnline();
  return (
    <div className="flex max-w-3xl flex-col gap-6 pb-6">
      <ReviewHeader kase={kase} />
      {!online && (
        <OfflineNote>
          You're offline. You're seeing the case as it was loaded; deciding needs a connection.
        </OfflineNote>
      )}
      <Checks kase={kase} />
      <BusinessDetails kase={kase} />
      <Evidence kase={kase} />
      <DecisionPanel kase={kase} />
    </div>
  );
}

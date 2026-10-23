import { useParams } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  askedFor,
  CheckDetails,
  Duplicates,
  ReviewHeader,
} from "../../../components/kyc/review/details";
import { DecisionPanel } from "../../../components/kyc/review/decision";
import { OfflineNote } from "../../../components/register/states";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { kycCaseQuery, kycSubjectQuery } from "../../../queries/kyc/cases";
import { rolesQuery, roleLabel } from "../../../queries/roles";
import { permissionsQuery } from "../../../queries/session/permissions";

/** One identity check: what was verified, the ID as far as it is shown, and the decision. */
export function KycReviewScreen() {
  const { caseId } = useParams({ from: "/_shop/kyc/$caseId" });
  const { data: kase } = useSuspenseQuery(kycCaseQuery(caseId));
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const online = useOnline();
  // The customer's name and the roles only dress the page: without permission to read them it shows the phone.
  const subject = useQuery({
    ...kycSubjectQuery(kase.customerId ?? ""),
    enabled: !!kase.customerId,
  });
  const roles = useQuery({ ...rolesQuery(), enabled: kase.purpose === "role" });
  const options = (roles.data ?? [])
    .filter((role) => !role.protectedOwner)
    .map((role) => ({ value: role.id, label: roleLabel(role) }));
  const requestedRole = options.find((role) => role.value === kase.requestedRoleId)?.label;
  return (
    <div className="flex max-w-3xl flex-col gap-6 pb-6">
      <ReviewHeader
        kase={kase}
        title={subject.data?.name ?? kase.phone}
        subtitle={kase.purpose === "credit" ? "Credit check" : "Staff role check"}
      />
      {!online && (
        <OfflineNote>
          You're offline. You're seeing the check as it was loaded; deciding needs a connection.
        </OfflineNote>
      )}
      <Duplicates kase={kase} />
      <CheckDetails kase={kase} asked={askedFor(kase, requestedRole)} />
      <DecisionPanel kase={kase} canApprove={held.includes("kyc.approve")} roles={options} />
    </div>
  );
}

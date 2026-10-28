import { useQuery } from "@tanstack/react-query";
import { Building2Icon, CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { ApiError } from "../../api/client";
import { EmptyList } from "../../components/admin/states";
import { KybForm } from "../../components/kyb/form";
import { KybSkeleton } from "../../components/kyb/states";
import { KybStatusNote } from "../../components/kyb/status";
import { Gate } from "../../components/register/states";
import { PaymentsPage } from "../../components/payments/page";
import { kybBanksQuery, kybQuery } from "../../queries/kyb";

/** The owner's business verification, which turns on mobile money payouts to the shop's own account. */
export function KybScreen() {
  return (
    <PaymentsPage active="verification">
      <Gate
        need="org.kyb.submit"
        what="business verification"
        verb="submit"
        fallback={<KybSkeleton />}
      >
        <div className="flex max-w-2xl flex-col gap-6 pb-6">
          <KybBody />
        </div>
      </Gate>
    </PaymentsPage>
  );
}

function KybBody() {
  const kyb = useQuery(kybQuery());
  const banks = useQuery(kybBanksQuery());
  if (kyb.isPending) return <KybSkeleton />;
  // The on-prem box takes no payouts: verification lives in the cloud portal.
  if (kyb.error instanceof ApiError && kyb.error.status === 404)
    return (
      <EmptyList
        icon={Building2Icon}
        title="Verification is done in the cloud portal"
        description="Sign in to the Shopper portal to verify the business. This shop computer keeps selling either way."
      />
    );
  if (kyb.isError) throw kyb.error;
  return (
    <>
      <KybStatusNote view={kyb.data} />
      {banks.isError && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            Couldn't load the banks payouts can go to, so the form can't be sent yet.
            <Button
              size="sm"
              variant="outline"
              disabled={banks.isFetching}
              onClick={() => void banks.refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <KybForm key={kyb.data.version} view={kyb.data} banks={banks.isError ? null : banks.data} />
    </>
  );
}

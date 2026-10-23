import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, WalletIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { EmptyList } from "../../../components/admin/states";
import { AgeingBodySkeleton } from "../../../components/customers/ageing/states";
import { AgeingTable } from "../../../components/customers/ageing/table";
import { QueryPanel } from "../../../components/customers/detail/panel";
import { CustomersPage } from "../../../components/customers/tabs";
import { Gate, OfflineNote } from "../../../components/register/states";
import { ageingQuery } from "../../../queries/customers/account";
import { useAgeingCsv } from "../../../queries/customers/csv";
import { usePermissions } from "../../../queries/session/permissions";

/** Who owes what, and for how long: each customer's balance by the age of its oldest charges, with the CSV. */
export function AgeingScreen() {
  const canRead = !!usePermissions()?.includes("customer.read");
  const csv = useAgeingCsv();
  const download = canRead && (
    <Button variant="outline" disabled={csv.isPending} onClick={() => csv.mutate()}>
      <DownloadIcon aria-hidden />
      {csv.isPending ? "Preparing…" : "Download CSV"}
      {!csv.isPending && <Kbd aria-hidden>D</Kbd>}
    </Button>
  );
  return (
    <CustomersPage active="ageing" action={download}>
      <Gate need="customer.read" what="ageing" fallback={<AgeingBodySkeleton />}>
        <Ageing onDownload={() => csv.mutate()} />
      </Gate>
    </CustomersPage>
  );
}

function Ageing({ onDownload }: { onDownload: () => void }) {
  const online = useOnline();
  const query = useQuery(ageingQuery());
  const shortcuts = useShortcuts({ D: onDownload });
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      {!online && (
        <OfflineNote>
          You're seeing the ageing loaded earlier. It updates when you reconnect.
        </OfflineNote>
      )}
      <QueryPanel query={query} what="ageing">
        {({ items }) =>
          items.length === 0 ? (
            <EmptyList
              icon={WalletIcon}
              title="Nobody owes you"
              description="Customers who buy on account and have not paid it off show here, by how late they are."
            />
          ) : (
            <AgeingTable rows={items} />
          )
        }
      </QueryPanel>
    </div>
  );
}

import { useRef } from "react";
import { useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { CustomersPage } from "../../../components/customers/tabs";
import { KycStartSheet } from "../../../components/kyc/start";
import { NoChecks } from "../../../components/kyc/queue/states";
import { Segments } from "../../../components/kyc/queue/segments";
import { CaseTable } from "../../../components/kyc/queue/table";
import { OfflineNote } from "../../../components/register/states";
import { usePanel } from "../../../hooks/admin/panel";
import { SEGMENTS } from "../../../lib/kyc/status";
import type { Segment } from "../../../lib/kyc/types";
import { kycListQuery } from "../../../queries/kyc/cases";

const OFFLINE_ID = "start-offline";

/** Identity checks sorted into Awaiting approval, Open and Closed, with the sheet that starts a new one. */
export function KycQueueScreen() {
  const { segment } = useSearch({ from: "/_shop/kyc" });
  const { data } = useSuspenseQuery(kycListQuery());
  const online = useOnline();
  const startRef = useRef<HTMLButtonElement>(null);
  const start = usePanel(startRef);
  const shortcuts = useShortcuts({ K: () => online && !start.open && start.show() });
  const counts = Object.fromEntries(
    SEGMENTS.map(({ value, statuses }) => [
      value,
      data.items.filter((kase) => statuses.includes(kase.status)).length,
    ]),
  ) as Record<Segment, number>;
  const current = SEGMENTS.find(({ value }) => value === segment)!;
  const cases = data.items.filter((kase) => current.statuses.includes(kase.status));
  const startButton = (
    <Button
      ref={startRef}
      disabled={!online}
      aria-describedby={online ? undefined : OFFLINE_ID}
      onClick={() => start.show()}
    >
      Start check
      <Kbd aria-hidden>K</Kbd>
    </Button>
  );
  return (
    <CustomersPage active="kyc" title="Identity checks" action={startButton}>
      <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
        {!online && (
          <div id={OFFLINE_ID}>
            <OfflineNote>
              You're offline. You can read the checks loaded earlier, but starting or deciding one
              needs a connection.
            </OfflineNote>
          </div>
        )}
        <Segments active={current.value} counts={counts}>
          {cases.length === 0 ? <NoChecks segment={current.value} /> : <CaseTable cases={cases} />}
        </Segments>
        <KycStartSheet
          open={start.open}
          onOpenChange={start.setOpen}
          restoreFocus={start.restoreFocus}
        />
      </div>
    </CustomersPage>
  );
}

import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input";
import { Kbd } from "@shopper/ui/components/kbd";
import { Label } from "@shopper/ui/components/label";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { Gate, OfflineNote } from "../../../components/register/states";
import { InputForm } from "../../../components/tax/returns/input";
import { InputTax, Worksheet } from "../../../components/tax/returns/worksheet";
import { TaxBodySkeleton } from "../../../components/tax/states";
import { TaxPage } from "../../../components/tax/tabs";
import { lastMonth, shopToday } from "../../../lib/tax/dates";
import { useReturnWorkbook, vatReturnQuery } from "../../../queries/tax/returns";
import { usePermissions } from "../../../queries/session/permissions";

/** The month's VAT return worksheet, the input tax claimed, and the workbook for the accountant to file from. */
export function VatReturnScreen() {
  const search = useSearch({ from: "/_shop/tax/returns" });
  const period = search.period ?? lastMonth(shopToday());
  const workbook = useReturnWorkbook(period);
  const canRead = !!usePermissions()?.includes("tax.read");
  const online = useOnline();
  const exporting = workbook.isPending || !online;
  const shortcuts = useShortcuts({ E: () => canRead && !exporting && workbook.mutate() });
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col">
      <TaxPage
        active="returns"
        action={
          canRead && (
            <Button variant="outline" disabled={exporting} onClick={() => workbook.mutate()}>
              <DownloadIcon aria-hidden />
              {workbook.isPending ? "Exporting…" : "Export to Excel"}
              <Kbd aria-hidden>E</Kbd>
            </Button>
          )
        }
      >
        <Gate
          need="tax.read"
          what="VAT returns"
          fallback={<TaxBodySkeleton label="Loading the VAT return" />}
        >
          <ReturnBody period={period} />
        </Gate>
      </TaxPage>
    </div>
  );
}

function ReturnBody({ period }: { period: string }) {
  const navigate = useNavigate();
  const online = useOnline();
  return (
    <div className="flex flex-col gap-6">
      {!online && (
        <OfflineNote>
          You're seeing the return loaded earlier. Reconnect to change or export it.
        </OfflineNote>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="return-period">Month</Label>
        <Input
          id="return-period"
          type="month"
          value={period}
          max={shopToday().slice(0, 7)}
          onChange={(event) =>
            event.target.value &&
            void navigate({
              to: "/tax/returns",
              search: { period: event.target.value },
              replace: true,
            })
          }
          className="w-48"
        />
      </div>
      <Suspense fallback={<TaxBodySkeleton label="Loading the VAT return" />}>
        <ReturnResults period={period} />
      </Suspense>
    </div>
  );
}

function ReturnResults({ period }: { period: string }) {
  const { data } = useSuspenseQuery(vatReturnQuery(period));
  const canFile = !!usePermissions()?.includes("tax.return");
  return (
    <Worksheet
      worksheet={data}
      // Keyed by month, so the form starts from the month shown.
      input={
        canFile ? <InputForm key={period} worksheet={data} /> : <InputTax input={data.input} />
      }
    />
  );
}

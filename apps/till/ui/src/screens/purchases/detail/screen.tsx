import { useState } from "react";
import type { PurchaseDetails } from "@shopper/sync/bridge";
import { toast } from "@shopper/ui/components/sonner";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { reprintBlock } from "../../../purchases/delivery";
import { returnBlock } from "../../../purchases/policy";
import type { PurchaseActions, PurchaseOutput, ReprintFeedback } from "../../../sale/types";
import { DetailEligibility } from "../../../components/purchases/detail/eligibility";
import { DetailHeader } from "../../../components/purchases/detail/header";
import { DetailItems } from "../../../components/purchases/detail/items";
import { DetailPayment } from "../../../components/purchases/detail/payment";
import { DetailReceipt } from "../../../components/purchases/detail/receipt";
import { DetailTotals } from "../../../components/purchases/detail/totals";

export function PurchaseDetail({
  purchase,
  output,
  reprint,
  actions,
  active,
}: {
  purchase: PurchaseDetails;
  output: PurchaseOutput | null;
  reprint: ReprintFeedback | null;
  actions: PurchaseActions;
  active: boolean;
}) {
  const [previewing, setPreviewing] = useState(false);
  const { delivery, receipt, eligibility } = purchase;
  const returnBlocked = eligibility && returnBlock(output, eligibility);
  async function reprintReceipt() {
    const blocked = reprintBlock(output);
    if (blocked) return void toast.error(blocked);
    if (reprint?.status === "running") return;
    const result = await actions.reprint(purchase.id);
    if (result.status === "done") toast.success("Receipt sent to the printer");
    else toast.error(result.message ?? "Receipt could not be printed");
  }
  function startReturn() {
    if (returnBlocked) return void toast.error(returnBlocked);
    actions.startReturn(purchase);
  }
  const togglePreview = () => receipt && setPreviewing((value) => !value);
  const register = useShortcuts(
    active
      ? {
          ...(delivery && { "Alt+R": () => void reprintReceipt(), "Alt+V": togglePreview }),
          ...(eligibility && { "Alt+E": startReturn }),
        }
      : {},
  );
  return (
    <section
      aria-label="Purchase details"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pb-1"
      ref={register}
      tabIndex={0}
    >
      <DetailHeader
        onReprint={() => void reprintReceipt()}
        onStartReturn={startReturn}
        output={output}
        purchase={purchase}
        reprint={reprint}
        returnBlocked={returnBlocked ?? null}
      />
      <div className="grid min-h-0 shrink-0 grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="grid min-w-0 grid-cols-1 content-start gap-4 xl:col-span-8">
          <DetailItems purchase={purchase} />
          {delivery && (
            <DetailReceipt
              delivery={delivery}
              onPreview={togglePreview}
              onReprint={() => void reprintReceipt()}
              output={output}
              previewing={previewing}
              purchase={purchase}
              reprint={reprint}
            />
          )}
        </div>
        <aside className="grid gap-4 xl:col-span-4">
          <DetailTotals purchase={purchase} />
          <DetailPayment purchase={purchase} />
          {eligibility && (
            <DetailEligibility
              block={returnBlocked ?? null}
              eligibility={eligibility}
              kinds={purchase.kinds}
              refunds={purchase.refunds}
            />
          )}
        </aside>
      </div>
    </section>
  );
}

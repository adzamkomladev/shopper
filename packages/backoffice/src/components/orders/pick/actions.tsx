import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BanIcon, CheckCheckIcon, PackageCheckIcon, PlayIcon, SendIcon, XIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { ConfirmDialog } from "../../admin/confirm/dialog";
import type { StaffOrder, Step } from "../../../schemas/orders";

type Ask = "decline" | "ready" | "cancel";
type Main = { step: Step; label: string; key: string; icon: LucideIcon };

const CONFIRM: Record<
  Ask,
  { title: string; description: string; label: string; destructive: boolean }
> = {
  decline: {
    title: "Decline this order?",
    description: "The shopper is refunded in full at once and the order ends.",
    label: "Decline order",
    destructive: true,
  },
  ready: {
    title: "Finish picking?",
    description:
      "Items you marked short or replaced are credited, and the shopper is refunded the difference. This can't be undone.",
    label: "Finish picking",
    destructive: false,
  },
  cancel: {
    title: "Cancel this order?",
    description:
      "The shopper is refunded in full, the goods go back on the shelf and the order ends.",
    label: "Cancel order",
    destructive: true,
  },
};

/** What can be done with the order now, by its status; the dangerous ones ask first. */
export function OrderActions({
  order,
  allChecked,
  pending,
  error,
  onStep,
  asking,
  onAsk,
}: {
  order: StaffOrder;
  allChecked: boolean;
  pending: boolean;
  error?: string;
  onStep: (step: Step) => void;
  asking: Ask | undefined;
  onAsk: (ask: Ask | undefined) => void;
}) {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const status = order.status;
  const live = ["paid", "accepted", "picking", "ready", "out_for_delivery"].includes(status);
  const main: Partial<Record<StaffOrder["status"], Main>> = {
    paid: { step: "accept", label: "Accept order", key: "A", icon: CheckCheckIcon },
    accepted: { step: "start", label: "Start picking", key: "S", icon: PlayIcon },
    ready:
      order.fulfilment === "delivery"
        ? { step: "dispatch", label: "Send out for delivery", key: "X", icon: SendIcon }
        : { step: "handover", label: "Mark handed over", key: "H", icon: PackageCheckIcon },
    out_for_delivery: {
      step: "handover",
      label: "Mark delivered",
      key: "H",
      icon: PackageCheckIcon,
    },
  };
  const primary = main[status];
  return (
    <section aria-labelledby="order-actions" className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 id="order-actions" className="text-base font-medium tracking-tight">
        Next step
      </h2>
      {primary && (
        <Button
          disabled={pending}
          aria-keyshortcuts={primary.key}
          onClick={() => onStep(primary.step)}
        >
          <primary.icon aria-hidden /> {primary.label} <Kbd>{primary.key}</Kbd>
        </Button>
      )}
      {status === "picking" && (
        <>
          <Button
            disabled={pending || !allChecked}
            aria-keyshortcuts="F"
            onClick={() => onAsk("ready")}
          >
            <PackageCheckIcon aria-hidden /> Finish picking <Kbd>F</Kbd>
          </Button>
          {!allChecked && (
            <p className="text-sm text-muted-foreground">Check every item before you finish.</p>
          )}
        </>
      )}
      {status === "paid" && (
        <Button
          variant="outline"
          disabled={pending}
          aria-keyshortcuts="D"
          onClick={() => onAsk("decline")}
        >
          <XIcon aria-hidden /> Decline <Kbd>D</Kbd>
        </Button>
      )}
      {live && status !== "paid" && (
        <Button
          variant="outline"
          disabled={pending}
          aria-keyshortcuts="C"
          ref={setTrigger}
          onClick={() => onAsk("cancel")}
        >
          <BanIcon aria-hidden /> Cancel order <Kbd>C</Kbd>
        </Button>
      )}
      {!live && (
        <p className="text-sm text-muted-foreground">
          {status === "completed" ? "This order was handed over." : "This order has ended."}
        </p>
      )}
      <ConfirmDialog
        open={asking !== undefined}
        onOpenChange={(open) => !open && onAsk(undefined)}
        title={CONFIRM[asking ?? "cancel"].title}
        description={CONFIRM[asking ?? "cancel"].description}
        confirmLabel={CONFIRM[asking ?? "cancel"].label}
        destructive={CONFIRM[asking ?? "cancel"].destructive}
        pending={pending}
        error={error}
        onConfirm={() => asking && onStep(asking)}
        restoreFocus={() => trigger?.focus()}
      />
    </section>
  );
}

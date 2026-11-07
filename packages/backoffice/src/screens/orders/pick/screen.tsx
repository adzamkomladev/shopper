import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { OrderActions } from "../../../components/orders/pick/actions";
import { OrderHeader } from "../../../components/orders/pick/header";
import { PickLine } from "../../../components/orders/pick/line";
import { SCAN_ID, ScanField } from "../../../components/orders/pick/scan";
import { ShortDialog } from "../../../components/orders/pick/substitute";
import { OfflineNote } from "../../../components/register/states";
import { holds } from "../../../lib/roles/permissions";
import { permissionsQuery } from "../../../queries/session/permissions";
import {
  stepMessage,
  staffOrderQuery,
  useOrderStep,
  usePickLine,
} from "../../../queries/orders/order";
import type { OrderLine, Step } from "../../../schemas/orders";

/** One order for the people filling it: the items to find, what was found, and the next step. */
export function PickScreen() {
  const { orderId } = useParams({ from: "/_shop/orders/$orderId" });
  const { data: order } = useQuery(staffOrderQuery(orderId));
  const [asking, setAsking] = useState<"decline" | "ready" | "cancel">();
  const [shortLine, setShortLine] = useState<OrderLine>();
  const { data: granted } = useQuery(permissionsQuery());
  const canFulfil = holds(granted, "order.fulfil");
  const step = useOrderStep(orderId, () => setAsking(undefined));
  const pickLine = usePickLine(orderId);
  const shortcuts = useShortcuts({
    "/": () => document.getElementById(SCAN_ID)?.focus(),
    A: () => run("accept", ["paid"]),
    S: () => run("start", ["accepted"]),
    H: () => run("handover", ["ready", "out_for_delivery"]),
    X: () => run("dispatch", ["ready"]),
    D: () => order?.status === "paid" && setAsking("decline"),
    C: () =>
      order &&
      ["accepted", "picking", "ready", "out_for_delivery"].includes(order.status) &&
      setAsking("cancel"),
    F: () => order?.status === "picking" && allChecked && setAsking("ready"),
  });
  if (!order) return null;
  const products = order.lines.filter((line) => line.kind === "product");
  const allChecked = products.every((line) => line.pick);
  const picking = order.status === "picking" && canFulfil;
  const run = (next: Step, from: string[]) => {
    if (canFulfil && from.includes(order.status) && !step.isPending) step.mutate(next);
  };
  const foundAll = (line: OrderLine) =>
    pickLine.mutate({ lineId: line.id, body: { pickedThousandths: line.quantityThousandths } });
  return (
    <div ref={shortcuts} className="flex flex-col gap-6">
      <Link
        to="/orders"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" /> Online orders
      </Link>
      <OrderHeader order={order} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          {order.adjustment && (
            <Alert>
              <AlertDescription>
                {`This order was changed in picking: the shopper pays ${formatGHS(money(order.adjustment.afterGross))} instead of ${formatGHS(money(order.adjustment.beforeGross))}${
                  order.adjustment.refundAmount > 0
                    ? ` and ${formatGHS(money(order.adjustment.refundAmount))} goes back to them`
                    : ""
                }.`}
              </AlertDescription>
            </Alert>
          )}
          {order.status === "picking" && (
            <ScanField lines={products} disabled={!picking} onFound={foundAll} />
          )}
          {pickLine.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{stepMessage(pickLine.error)}</AlertDescription>
            </Alert>
          )}
          <ul className="flex flex-col gap-3" aria-label="Items">
            {order.lines.map((line) => (
              <PickLine
                key={line.id}
                line={line}
                picking={picking}
                busy={pickLine.isPending}
                onFoundAll={() => foundAll(line)}
                onShort={() => setShortLine(line)}
              />
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          {canFulfil ? (
            <OrderActions
              order={order}
              allChecked={allChecked}
              pending={step.isPending}
              error={step.error ? stepMessage(step.error) : undefined}
              onStep={(next) => step.mutate(next)}
              asking={asking}
              onAsk={setAsking}
            />
          ) : (
            <OfflineNote>
              You can read this order. Filling it needs the order.fulfil permission.
            </OfflineNote>
          )}
        </div>
      </div>
      <ShortDialog
        key={shortLine?.id}
        line={shortLine}
        onClose={() => setShortLine(undefined)}
        pending={pickLine.isPending}
        error={pickLine.error ? stepMessage(pickLine.error) : undefined}
        onSave={(body) =>
          shortLine &&
          pickLine.mutate(
            { lineId: shortLine.id, body },
            { onSuccess: () => setShortLine(undefined) },
          )
        }
      />
    </div>
  );
}

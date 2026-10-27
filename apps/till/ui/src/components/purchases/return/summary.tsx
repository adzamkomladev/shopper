import { Loader2, Undo2 } from "lucide-react";
import { formatGHS } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import { FieldError } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import type { useReturnForm } from "../../../hooks/purchases/return/form";
import type { ApproverState } from "../../../sale/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { ApprovalFields } from "../../approval/fields";
import { RemoteApproval } from "../../approval/remote";

/** The refund in numbers, the manager when one is needed, any refusal, and the one button that sends it. */
export function ReturnSummary({
  form,
  approvers,
  approvalNote,
  onRetryApprovers,
}: {
  form: ReturnType<typeof useReturnForm>;
  approvers: ApproverState;
  /** Why a manager must approve, or null when the cashier may refund alone. */
  approvalNote: string | null;
  onRetryApprovers: () => void;
}) {
  const { preview, manager, remote, block, count } = form;
  return (
    <section aria-label="Refund summary" className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Refund summary</h3>
        <p className="text-xs text-muted-foreground">
          {count === 0
            ? "No items chosen yet"
            : `${count} ${count === 1 ? "item" : "items"} chosen`}
        </p>
      </div>
      <div className="grid gap-4 p-4">
        {preview && (
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Before tax</dt>
              <dd className="font-medium tabular-nums">{formatGHS(preview.base)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="font-medium tabular-nums">{formatGHS(preview.tax)}</dd>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-3">
              <dt className="text-base font-bold">Refund total</dt>
              <dd className="text-xl font-bold tabular-nums">{formatGHS(preview.gross)}</dd>
            </div>
          </dl>
        )}
        {approvalNote && <p className="text-sm text-muted-foreground">{approvalNote}</p>}
        {approvalNote && (
          <Tabs
            className="gap-3"
            onValueChange={(value) => remote.setMode(value === "remote" ? "remote" : "pin")}
            value={remote.mode}
          >
            <TabsList className="h-12 w-full">
              <TabsTrigger className="h-11" value="pin">
                Manager here <Kbd className="max-sm:hidden">Alt+P</Kbd>
              </TabsTrigger>
              <TabsTrigger className="h-11" value="remote">
                Ask remotely <Kbd className="max-sm:hidden">Alt+R</Kbd>
              </TabsTrigger>
            </TabsList>
            <TabsContent className="grid gap-4" value="pin">
              <ApprovalFields
                approvers={approvers}
                form={manager}
                onRetry={onRetryApprovers}
                permission="refund.approve"
              />
            </TabsContent>
            <TabsContent value="remote">
              <RemoteApproval
                approved={remote.approved}
                canAsk={count > 0 && !!preview && form.reason.trim() !== ""}
                onAsk={remote.ask}
                state={remote.state}
              />
            </TabsContent>
          </Tabs>
        )}
        {manager.problem && <FieldError>{manager.problem}</FieldError>}
        <Button
          aria-describedby={block ? "refund-block" : undefined}
          className="w-full"
          disabled={!!block || manager.pending}
          size="touch"
          type="submit"
          variant="destructive"
        >
          {manager.pending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Undo2 aria-hidden="true" />
          )}
          {manager.pending
            ? "Refunding…"
            : preview
              ? `Refund ${formatGHS(preview.gross)}`
              : "Refund"}{" "}
          <Kbd className="max-sm:hidden">Ctrl+Enter</Kbd>
        </Button>
        {block && (
          <p className="-mt-2 text-center text-xs text-muted-foreground" id="refund-block">
            {block}
          </p>
        )}
      </div>
    </section>
  );
}

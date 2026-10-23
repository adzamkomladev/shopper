import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { focusOnMount } from "../../../lib/focus";
import type { CustomerView } from "../../../queries/customers/types";

type Props = {
  customer: CustomerView;
  /** Each action is absent when the member cannot do it, or when it makes no sense for this customer. */
  onEdit?: () => void;
  onMerge?: () => void;
  onArchive?: () => void;
  onVerify?: () => void;
  archiving: boolean;
  editRef: React.Ref<HTMLButtonElement>;
  mergeRef: React.Ref<HTMLButtonElement>;
  archiveRef: React.Ref<HTMLButtonElement>;
  verifyRef: React.Ref<HTMLButtonElement>;
};

/** The back link, the name with its line, and the actions with their keys. */
export function CustomerHeader({ customer, archiving, ...actions }: Props) {
  const { name, businessName, archivedAt, mergedIntoId, kycVerifiedAt } = customer;
  return (
    <div className="flex flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start text-muted-foreground">
        <Link to="/customers" search={archivedAt ? { segment: "archived" } : {}}>
          <ArrowLeftIcon aria-hidden />
          Back to customers
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          {/* Focused on arrival, so the screen's shortcuts work straight after navigating here. */}
          <h1
            tabIndex={-1}
            ref={focusOnMount}
            className="text-3xl font-bold tracking-tight wrap-break-word outline-none"
          >
            {name}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {businessName ?? customer.phone}
            {archivedAt && <Badge variant="outline">{mergedIntoId ? "Merged" : "Archived"}</Badge>}
            <Badge variant={kycVerifiedAt ? "secondary" : "outline"}>
              {kycVerifiedAt ? "KYC verified" : "Not verified"}
            </Badge>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.onVerify && (
            <Button ref={actions.verifyRef} variant="outline" onClick={actions.onVerify}>
              Verify identity
              <Kbd aria-hidden>K</Kbd>
            </Button>
          )}
          {actions.onEdit && (
            <Button ref={actions.editRef} variant="outline" onClick={actions.onEdit}>
              Edit
              <Kbd aria-hidden>E</Kbd>
            </Button>
          )}
          {actions.onMerge && (
            <Button ref={actions.mergeRef} variant="outline" onClick={actions.onMerge}>
              Merge
              <Kbd aria-hidden>M</Kbd>
            </Button>
          )}
          {actions.onArchive && (
            <Button
              ref={actions.archiveRef}
              variant="outline"
              disabled={archiving}
              onClick={actions.onArchive}
            >
              {archivedAt ? "Restore" : "Archive"}
              <Kbd aria-hidden>Alt A</Kbd>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

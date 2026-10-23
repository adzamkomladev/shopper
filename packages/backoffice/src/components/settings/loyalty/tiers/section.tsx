import { useRef } from "react";
import { LayersIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { usePanel } from "../../../../hooks/admin/panel";
import { useArchiveTier } from "../../../../queries/settings/tiers";
import type { TierView } from "../../../../schemas/settings/loyalty";
import { ConfirmDialog } from "../../../admin/confirm/dialog";
import { FormSheet } from "../../../admin/form/sheet";
import { EmptyList } from "../../../admin/states";
import { TierForm } from "./form";
import { archiveTierId, editTierId, TierTable } from "./table";

/** The tiers a customer can sit in, with add, edit and archive. Whoever can open the page (`customer.manage`) can change them. */
export function TierSection({ tiers }: { tiers: TierView[] }) {
  const addRef = useRef<HTMLButtonElement>(null);
  const form = usePanel<TierView>(addRef);
  const removal = usePanel<TierView>(addRef);
  const archive = useArchiveTier(() => removal.setOpen(false));
  const shortcuts = useShortcuts({
    N: () => !form.open && !removal.open && form.show(),
  });
  return (
    <section ref={shortcuts} aria-labelledby="tiers-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="tiers-heading" className="text-xl font-semibold tracking-tight">
            Tiers
          </h2>
          <p className="text-sm text-muted-foreground">
            A customer moves up a tier when what they spend over a year reaches its minimum.
          </p>
        </div>
        {tiers.length > 0 && (
          <Button ref={addRef} onClick={() => form.show()}>
            Add tier
            <Kbd aria-hidden>N</Kbd>
          </Button>
        )}
      </div>
      {tiers.length === 0 ? (
        <EmptyList
          icon={LayersIcon}
          title="No tiers yet"
          description="Every customer earns at the shop's rate. Add a tier to reward the ones who spend more."
        >
          <Button ref={addRef} onClick={() => form.show()}>
            Add tier
            <Kbd aria-hidden>N</Kbd>
          </Button>
        </EmptyList>
      ) : (
        <TierTable
          tiers={tiers}
          onEdit={(tier) => form.show(tier, editTierId(tier.id))}
          onArchive={(tier) => removal.show(tier, archiveTierId(tier.id))}
        />
      )}
      <FormSheet
        open={form.open}
        onOpenChange={form.setOpen}
        title={form.value ? "Edit tier" : "New tier"}
        description="Name the tier, the yearly spend that earns it and the rate it earns at."
        restoreFocus={form.restoreFocus}
      >
        <TierForm
          key={form.value?.id ?? "new"}
          tier={form.value}
          onSaved={() => form.setOpen(false)}
        />
      </FormSheet>
      <ConfirmDialog
        open={removal.open}
        onOpenChange={(open) => {
          if (!open) archive.reset();
          removal.setOpen(open);
        }}
        title={`Archive ${removal.value?.name ?? "this tier"}?`}
        description="Customers can no longer move into it. What they have already earned stays."
        confirmLabel="Archive tier"
        error={archive.error?.message}
        pending={archive.isPending}
        onConfirm={() => removal.value && archive.mutate(removal.value)}
        restoreFocus={removal.restoreFocus}
      />
    </section>
  );
}

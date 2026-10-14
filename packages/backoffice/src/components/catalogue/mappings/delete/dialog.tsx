import { useDeleteMapping } from "../../../../queries/catalogue/mappings";
import { mappingFailure, type MappingView } from "../../../../schemas/catalogue/mappings";
import { ConfirmDialog } from "../../../admin/confirm/dialog";

type Props = {
  mapping?: MappingView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

export function DeleteMappingDialog({ mapping, open, onOpenChange, restoreFocus }: Props) {
  const remove = useDeleteMapping(() => onOpenChange(false));
  const prefix = mapping?.prefix ?? "this";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
      title={`Delete the layout for prefix ${prefix}?`}
      description="Tills will no longer read weights or prices from labels with this prefix. Scanning those labels will no longer add products."
      confirmLabel="Delete layout"
      error={remove.error ? mappingFailure(remove.error, String(prefix)).message : undefined}
      pending={remove.isPending}
      onConfirm={() => mapping && remove.mutate(mapping)}
      restoreFocus={restoreFocus}
    />
  );
}

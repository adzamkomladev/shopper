import { Button } from "@shopper/ui/components/button";

type Props = {
  /** What the row is, so each button's name says which row it acts on. */
  name: string;
  /** Ids let a closing dialog hand focus back to the button that opened it. */
  id: string;
  onEdit?: () => void;
  onDelete?: () => void;
};

export const editButtonId = (id: string) => `edit-${id}`;
export const deleteButtonId = (id: string) => `delete-${id}`;

/** Edit and Delete for one table row. Both stay reachable by Tab; the dialogs they open take Enter and Escape. */
export function RowActions({ name, id, onEdit, onDelete }: Props) {
  return (
    <div
      className="flex justify-end gap-2"
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLButtonElement) {
          event.target.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      }}
    >
      {onEdit && (
        <Button
          id={editButtonId(id)}
          variant="outline"
          size="sm"
          aria-label={`Edit ${name}`}
          onClick={onEdit}
        >
          Edit
        </Button>
      )}
      {onDelete && (
        <Button
          id={deleteButtonId(id)}
          variant="outline"
          size="sm"
          aria-label={`Delete ${name}`}
          onClick={onDelete}
        >
          Delete
        </Button>
      )}
    </div>
  );
}

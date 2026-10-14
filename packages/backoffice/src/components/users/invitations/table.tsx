import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { useNow } from "@shopper/ui/hooks/use-now";
import { formatDate } from "../../../lib/catalogue/detail/prices/groups";
import { deliveryNote, present } from "../../../lib/users/invitation/status";
import type { InvitationView } from "../../../queries/users";

const CLOCK_MS = 60_000;

export const cancelButtonId = (id: string) => `cancel-${id}`;

type Props = {
  invitations: InvitationView[];
  /** Role names by id; an invitation to a role this member can't read shows a dash. */
  roleNames: ReadonlyMap<string, string>;
  /** Present only for members who may invite. */
  actions?: {
    pending: boolean;
    onReissue: (invitation: InvitationView) => void;
    onCancel: (invitation: InvitationView) => void;
  };
};

export function InvitationsTable({ invitations, roleNames, actions }: Props) {
  const now = useNow(CLOCK_MS);
  const columns: DataTableColumn<InvitationView>[] = [
    {
      id: "email",
      header: "Invited",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.email}</span>
          <span className="text-muted-foreground">
            {row.original.channel === "email" ? "By email" : "By setup link"}
          </span>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => (row.original.roleId && roleNames.get(row.original.roleId)) || "—",
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = present(row.original, now);
        const delivery = status.label === "Pending" ? deliveryNote(row.original) : undefined;
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={status.variant}>{status.label}</Badge>
            {delivery && <span className="text-xs text-muted-foreground">{delivery}</span>}
          </div>
        );
      },
    },
    {
      id: "expires",
      header: "Expires",
      cell: ({ row }) => formatDate(row.original.expiresAt),
    },
  ];
  if (actions)
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const invitation = row.original;
        if (!present(invitation, now).open) return null;
        const byEmail = invitation.channel === "email";
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={actions.pending}
              aria-label={
                byEmail
                  ? `Resend invitation to ${invitation.email}`
                  : `New link for ${invitation.email}`
              }
              onClick={() => actions.onReissue(invitation)}
            >
              {byEmail ? "Resend" : "New link"}
            </Button>
            <Button
              id={cancelButtonId(invitation.id)}
              variant="outline"
              size="sm"
              aria-label={`Cancel invitation for ${invitation.email}`}
              onClick={() => actions.onCancel(invitation)}
            >
              Cancel
            </Button>
          </div>
        );
      },
    });
  return (
    <DataTable
      label="Invitations"
      columns={columns}
      data={invitations}
      getRowId={(invitation) => invitation.id}
      className="max-h-96"
    />
  );
}

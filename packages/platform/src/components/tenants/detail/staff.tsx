import { UsersIcon } from "lucide-react";
import { EmptyList, shiftTime } from "@shopper/backoffice/kit";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import type { TenantDetail } from "../../../schemas/types";
import { Stats } from "./header";

type Staff = TenantDetail["staff"];

const person = (name: string, email: string) => (
  <div className="flex flex-col">
    <span className="font-medium">{name}</span>
    <span className="text-xs text-muted-foreground">{email}</span>
  </div>
);

const memberColumns: DataTableColumn<Staff["members"][number]>[] = [
  {
    id: "member",
    header: "Member",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => person(row.original.name, row.original.email),
  },
  {
    id: "role",
    header: "Role",
    cell: ({ row }) => (
      <span className="capitalize">
        {row.original.role}
        {row.original.owner && <span className="text-muted-foreground"> · owner</span>}
      </span>
    ),
  },
  {
    id: "state",
    header: "State",
    cell: ({ row }) =>
      row.original.active ? (
        <Badge variant="secondary">Active</Badge>
      ) : (
        <Badge variant="outline">Deactivated</Badge>
      ),
  },
  {
    id: "joined",
    header: "Joined",
    meta: { className: "hidden md:table-cell" },
    cell: ({ row }) => shiftTime(row.original.createdAt),
  },
];

const invitationColumns: DataTableColumn<Staff["invitations"][number]>[] = [
  {
    id: "email",
    header: "Invited",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => person(row.original.email, `By ${row.original.channel}`),
  },
  {
    id: "role",
    header: "Role",
    cell: ({ row }) => <span className="capitalize">{row.original.role ?? "Member"}</span>,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "pending" ? "secondary" : "outline"}>
        <span className="capitalize">{row.original.status}</span>
      </Badge>
    ),
  },
  {
    id: "expires",
    header: "Expires",
    meta: { className: "hidden md:table-cell" },
    cell: ({ row }) => shiftTime(row.original.expiresAt),
  },
];

/** Everyone who can sign in to the shop and their roles, then the invitations sent. */
export function TenantStaff({ staff }: { staff: Staff }) {
  const active = staff.members.filter((member) => member.active).length;
  return (
    <>
      <Stats
        items={[
          ["Active members", active],
          ["Deactivated", staff.members.length - active],
          [
            "Pending invitations",
            staff.invitations.filter((row) => row.status === "pending").length,
          ],
        ]}
      />
      <h2 className="text-base font-semibold">Members</h2>
      {staff.members.length ? (
        <DataTable
          label="Members"
          columns={memberColumns}
          data={staff.members}
          getRowId={(member) => member.id}
        />
      ) : (
        <EmptyList
          icon={UsersIcon}
          title="No members"
          description="Nobody can sign in to this shop."
        />
      )}
      <h2 className="text-base font-semibold">Invitations</h2>
      {staff.invitations.length ? (
        <DataTable
          label="Invitations"
          columns={invitationColumns}
          data={staff.invitations}
          getRowId={(invitation) => invitation.id}
        />
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          The shop has not invited anyone.
        </p>
      )}
    </>
  );
}

import { CircleIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { deleteButtonId } from "../admin/row/actions";
import { formatDate } from "../../lib/catalogue/detail/prices/groups";
import type { DeviceView } from "../../queries/devices";

type Props = {
  devices: DeviceView[];
  /** Present only for members who may revoke. */
  onRevoke?: (device: DeviceView) => void;
};

export function DeviceTable({ devices, onRevoke }: Props) {
  const columns: DataTableColumn<DeviceView>[] = [
    {
      id: "name",
      header: "Device",
      meta: { className: "whitespace-normal font-medium" },
      cell: ({ row }) => row.original.name,
    },
    { id: "branch", header: "Branch", cell: ({ row }) => row.original.branchName },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.status === "active" ? (
          <Badge variant="outline">
            <CircleIcon aria-hidden className="fill-success text-success" />
            Active
          </Badge>
        ) : (
          <Badge variant="secondary">Revoked</Badge>
        ),
    },
    { id: "added", header: "Added", cell: ({ row }) => formatDate(row.original.createdAt) },
  ];
  if (onRevoke)
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        row.original.status === "active" && (
          <div className="flex justify-end">
            <Button
              id={deleteButtonId(row.original.id)}
              variant="outline"
              size="sm"
              aria-label={`Revoke ${row.original.name}`}
              onClick={() => onRevoke(row.original)}
            >
              Revoke
            </Button>
          </div>
        ),
    });
  return (
    <DataTable
      label="Devices"
      columns={columns}
      data={devices}
      getRowId={(device) => device.id}
      className="min-h-0"
    />
  );
}

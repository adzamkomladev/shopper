import { MonitorSmartphoneIcon, StoreIcon } from "lucide-react";
import { EmptyList, shiftTime } from "@shopper/backoffice/kit";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Section } from "../../kyb/review/details";
import type { TenantDetail } from "../../../schemas/types";
import { Stats } from "./header";

type Store = TenantDetail["stores"][number];
type Register = Store["branches"][number]["devices"][number];

const columns: DataTableColumn<Register>[] = [
  {
    id: "register",
    header: "Register",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.name}</span>
        <span className="text-xs text-muted-foreground">{row.original.code || "No code"}</span>
      </div>
    ),
  },
  {
    id: "seen",
    header: "Last seen",
    cell: ({ row }) =>
      row.original.lastSeenAt ? (
        shiftTime(row.original.lastSeenAt)
      ) : (
        <span className="text-muted-foreground">Never</span>
      ),
  },
  {
    id: "state",
    header: "State",
    cell: ({ row }) =>
      row.original.revoked ? (
        <Badge variant="destructive">Revoked</Badge>
      ) : (
        <Badge variant="outline">Enrolled</Badge>
      ),
  },
  {
    id: "enrolled",
    header: "Added",
    meta: { className: "hidden md:table-cell" },
    cell: ({ row }) => shiftTime(row.original.createdAt),
  },
];

/** Each store with its branches and their registers; last seen is the newest sign-in or upload. */
export function TenantStores({ stores }: { stores: Store[] }) {
  if (!stores.length)
    return (
      <EmptyList
        icon={StoreIcon}
        title="No stores yet"
        description="The owner adds the first store in the setup wizard."
      />
    );
  const registers = stores.flatMap((store) => store.branches.flatMap((branch) => branch.devices));
  const seen = registers
    .flatMap((register) => register.lastSeenAt ?? [])
    .sort()
    .at(-1);
  return (
    <>
      <Stats
        items={[
          ["Stores", stores.length],
          ["Branches", stores.flatMap((store) => store.branches).length],
          ["Registers", registers.length],
          ["Last register seen", seen ? shiftTime(seen) : "Never"],
        ]}
      />
      {stores.map((store) => (
        <Section key={store.id} label={store.name}>
          <p className="-mt-2 text-sm text-muted-foreground">
            Open {store.opensAt.slice(0, 5)} – {store.closesAt.slice(0, 5)}
          </p>
          {store.branches.map((branch) => (
            <div key={branch.id} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                {branch.name}
                {branch.code && <span className="text-muted-foreground"> · {branch.code}</span>}
              </h3>
              {branch.devices.length ? (
                <DataTable
                  label={`Registers at ${branch.name}`}
                  columns={columns}
                  data={branch.devices}
                  getRowId={(register) => register.id}
                />
              ) : (
                <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  <MonitorSmartphoneIcon className="size-4" aria-hidden />
                  No registers enrolled at this branch.
                </p>
              )}
            </div>
          ))}
        </Section>
      ))}
    </>
  );
}

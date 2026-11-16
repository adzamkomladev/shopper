import { PackageIcon } from "lucide-react";
import { EmptyList, shiftTime } from "@shopper/backoffice/kit";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import type { TenantDetail } from "../../../schemas/types";
import { Stats } from "./header";

type Products = TenantDetail["products"];

const columns: DataTableColumn<Products["sample"][number]>[] = [
  {
    id: "product",
    header: "Product",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.name}</span>
        <span className="text-xs text-muted-foreground">{row.original.sku}</span>
      </div>
    ),
  },
  {
    id: "state",
    header: "State",
    cell: ({ row }) =>
      row.original.archivedAt ? (
        <Badge variant="outline">Archived</Badge>
      ) : (
        <Badge variant="secondary">Active</Badge>
      ),
  },
  {
    id: "online",
    header: "Online",
    meta: { className: "hidden md:table-cell" },
    cell: ({ row }) => (row.original.onlineVisible ? "Listed" : "Hidden"),
  },
  {
    id: "updated",
    header: "Changed",
    meta: { className: "hidden lg:table-cell" },
    cell: ({ row }) => shiftTime(row.original.updatedAt),
  },
];

/** How big the catalogue is, and the products changed most recently. */
export function TenantProducts({ products }: { products: Products }) {
  return (
    <>
      <Stats
        items={[
          ["Active", products.active],
          ["Archived", products.archived],
        ]}
      />
      {products.sample.length ? (
        <>
          <h2 className="text-base font-semibold">
            Recently changed
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {products.sample.length} of {products.active + products.archived}
            </span>
          </h2>
          <DataTable
            label="Recently changed products"
            columns={columns}
            data={products.sample}
            getRowId={(product) => product.id}
          />
        </>
      ) : (
        <EmptyList
          icon={PackageIcon}
          title="No products yet"
          description="The shop adds them one by one or imports a spreadsheet."
        />
      )}
    </>
  );
}

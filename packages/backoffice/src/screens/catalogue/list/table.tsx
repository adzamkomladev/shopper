import { Link } from "@tanstack/react-router";
import { money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { TAX_CLASSES, UNITS } from "./options";
import type { CategoryView, ProductSummary } from "./queries";

// Phones show the product and its price; the rest is folded into the product cell.
const DESKTOP_ONLY = "hidden md:table-cell";

type Props = {
  products: ProductSummary[];
  categories: CategoryView[];
  onEndReached: () => void;
};

export function ProductTable({ products, categories, onEndReached }: Props) {
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const columns: DataTableColumn<ProductSummary>[] = [
    {
      id: "product",
      header: "Product",
      // Wraps long names on phones, so the price column stays in view.
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <Link
            to="/products/$productId"
            params={{ productId: row.original.id }}
            className="w-fit font-medium hover:underline"
          >
            {row.original.name}
          </Link>
          <span className="text-xs text-muted-foreground">{row.original.sku}</span>
          <span className="text-xs text-muted-foreground md:hidden">
            {unitLabel(row.original)} ·{" "}
            {categoryName.get(row.original.categoryId ?? "") ?? "No category"}
          </span>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      meta: { className: DESKTOP_ONLY },
      cell: ({ row }) =>
        categoryName.get(row.original.categoryId ?? "") ?? <Muted>No category</Muted>,
    },
    {
      id: "unit",
      header: "Unit",
      meta: { className: DESKTOP_ONLY },
      cell: ({ row }) => unitLabel(row.original),
    },
    {
      id: "price",
      header: "Price",
      meta: { align: "right" },
      cell: ({ row }) =>
        row.original.price === null ? (
          <Muted>No price</Muted>
        ) : (
          <Money amount={money(row.original.price)} className="font-medium" />
        ),
    },
    {
      id: "tax",
      header: "Tax class",
      meta: { className: DESKTOP_ONLY },
      cell: ({ row }) => (
        <Badge variant="secondary">
          {TAX_CLASSES.find((tax) => tax.value === row.original.taxClass)?.label}
        </Badge>
      ),
    },
    {
      id: "online",
      header: "Online",
      meta: { className: DESKTOP_ONLY },
      cell: ({ row }) => (
        <Badge variant={row.original.onlineVisible ? "default" : "outline"}>
          {row.original.onlineVisible ? "Online" : "Store only"}
        </Badge>
      ),
    },
  ];
  return (
    <DataTable
      label="Products"
      columns={columns}
      data={products}
      getRowId={(product) => product.id}
      onEndReached={onEndReached}
      className="min-h-0"
    />
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

function unitLabel(product: ProductSummary) {
  return UNITS.find((unit) => unit.value === product.baseUnit)?.label;
}

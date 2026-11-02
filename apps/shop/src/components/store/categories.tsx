import { Link } from "@tanstack/react-router";
import type { StoreInfo } from "../../schemas/store";

const chip =
  "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none";
const on = "border-primary bg-primary text-primary-foreground hover:bg-primary/90";

/** The categories as chips that scroll sideways on a phone; "All" goes back to the whole store. */
export function CategoryChips({
  shop,
  categories,
  active,
  branchId,
}: {
  shop: string;
  categories: StoreInfo["categories"];
  active?: string;
  branchId: string;
}) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-2 pb-1">
        <li>
          <Link
            to="/$shop"
            params={{ shop }}
            search={{ branch: branchId }}
            aria-current={active ? undefined : "page"}
            className={`${chip} ${active ? "bg-card" : on}`}
          >
            All
          </Link>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              to="/$shop/categories/$id"
              params={{ shop, id: category.id }}
              search={{ branch: branchId }}
              aria-current={active === category.id ? "page" : undefined}
              className={`${chip} ${active === category.id ? on : "bg-card"}`}
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

import { Link } from "@tanstack/react-router";
import type { StoreInfo } from "../../schemas/store";

const chip =
  "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const on = "border-foreground bg-foreground text-background";
const off = "border-border bg-card text-foreground hover:bg-shop-glow";

/** The categories as one row of chips that scrolls sideways (no scrollbar); "All" goes back to the whole store. */
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
    <nav
      aria-label="Categories"
      className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex gap-2">
        <li>
          <Link
            to="/$shop"
            params={{ shop }}
            search={{ branch: branchId }}
            aria-current={active ? undefined : "page"}
            className={`${chip} ${active ? off : on}`}
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
              className={`${chip} ${active === category.id ? on : off}`}
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

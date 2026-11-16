import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import type { ProductSearch } from "../../../queries/catalogue/list";

type Props = { page: number; pageSize: number; total: number };

/** "21–40 of 20,000" and Previous / Next links that keep the rest of the search. */
export function ProductPager({ page, pageSize, total }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground tabular-nums">
        {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">
          Page {page.toLocaleString()} of {pages.toLocaleString()}
        </span>
        <PageLink to={page - 1} disabled={page <= 1} label="Previous page">
          <ChevronLeftIcon aria-hidden />
          <span className="max-sm:sr-only">Previous</span>
        </PageLink>
        <PageLink to={page + 1} disabled={page >= pages} label="Next page">
          <span className="max-sm:sr-only">Next</span>
          <ChevronRightIcon aria-hidden />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink(props: {
  to: number;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className={props.disabled ? "pointer-events-none opacity-50" : undefined}
    >
      <Link
        to="/products"
        search={(previous: ProductSearch) => ({
          ...previous,
          page: props.to > 1 ? props.to : undefined,
        })}
        aria-label={props.label}
        // Blocks a focused link's Enter too, not only the pointer.
        disabled={props.disabled}
        aria-disabled={props.disabled}
        tabIndex={props.disabled ? -1 : undefined}
      >
        {props.children}
      </Link>
    </Button>
  );
}

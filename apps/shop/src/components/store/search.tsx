import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Kbd } from "@shopper/ui/components/kbd";

/**
 * The store's search. A plain GET form, so it works before the page hydrates; once it has, it navigates in place.
 * `/` focuses it from anywhere on the page.
 */
export function StoreSearch({
  q,
  branchId,
  inputRef,
}: {
  q?: string;
  branchId: string;
  inputRef: React.Ref<HTMLInputElement>;
}) {
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("q");
        const text = typeof value === "string" ? value.trim() : "";
        void navigate({
          to: ".",
          search: { branch: branchId, q: text || undefined },
        });
      }}
    >
      <input type="hidden" name="branch" value={branchId} />
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        key={q ?? ""}
        type="search"
        name="q"
        defaultValue={q}
        aria-label="Search the store"
        aria-keyshortcuts="/"
        placeholder="Search for rice, oil, milk…"
        maxLength={100}
        className="h-14 w-full rounded-2xl border bg-card pr-14 pl-13 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <Kbd className="absolute top-1/2 right-5 hidden -translate-y-1/2 sm:inline-flex">/</Kbd>
    </form>
  );
}

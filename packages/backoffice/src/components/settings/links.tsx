import { Link } from "@tanstack/react-router";

const PAGES = [
  { to: "/settings/loyalty", label: "Loyalty" },
  { to: "/settings/credit", label: "Credit" },
  { to: "/settings/statements", label: "Statements" },
  { to: "/settings/kyc", label: "Identity checks" },
] as const;

/** The customer settings pages, so each is one click from the others. */
export function SettingsLinks() {
  return (
    <nav aria-label="Settings" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {PAGES.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className="font-medium text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

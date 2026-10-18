import type { ReactNode } from "react";

/** A titled block of the report. `empty` shows in place of the table when nothing was sold. */
export function ReportSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string | null;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {empty ? <p className="p-6 text-sm text-muted-foreground">{empty}</p> : children}
      </div>
    </section>
  );
}

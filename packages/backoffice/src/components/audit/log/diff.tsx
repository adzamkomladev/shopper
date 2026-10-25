import { auditDiff } from "../../../lib/audit/diff";

/** Before and after, field by field; a changed field is marked, so the change reads at a glance. */
export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const rows = auditDiff(before, after);
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">No before or after was recorded.</p>;
  return (
    <table className="w-full table-fixed text-sm">
      <caption className="sr-only">Changes, field by field</caption>
      <thead className="text-left text-xs text-muted-foreground">
        <tr>
          <th scope="col" className="w-1/4 pb-2 font-medium">
            Field
          </th>
          <th scope="col" className="pb-2 font-medium">
            Before
          </th>
          <th scope="col" className="pb-2 font-medium">
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.field}
            data-changed={row.changed || undefined}
            className="border-t align-top data-changed:bg-accent/60"
          >
            <th scope="row" className="py-1.5 pr-2 text-left font-medium break-words">
              {row.field}
              {row.changed && <span className="sr-only"> (changed)</span>}
            </th>
            <td className="py-1.5 pr-2 break-words text-muted-foreground">{row.before ?? "—"}</td>
            <td className="py-1.5 break-words">{row.after ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

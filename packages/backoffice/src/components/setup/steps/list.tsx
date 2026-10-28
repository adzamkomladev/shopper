/** What a step has made so far, by name; nothing yet shows nothing. */
export function NameList({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{label}</h3>
      <ul className="flex flex-wrap gap-2">
        {names.map((name) => (
          <li key={name} className="rounded-md border bg-muted/50 px-3 py-1 text-sm">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One connected device: an icon, what it is, how it is connected and, optionally, its status badge. */
export function DeviceRow({
  icon,
  title,
  description,
  note,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** A second muted line, for what the badge is based on. */
  note?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card px-2 py-1.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-none font-medium">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
        {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
      </div>
      {badge}
    </div>
  );
}

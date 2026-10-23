import { Card } from "@shopper/ui/components/card";

type Props = { label: string; action?: React.ReactNode; children: React.ReactNode };

/** One figure under its label, in a card (Figma "Purchase #10482" summary cards). */
export function Stat({ label, action, children }: Props) {
  return (
    <Card role="group" aria-label={label} className="min-h-28 justify-between gap-2 px-4 py-4">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p className="text-sm whitespace-nowrap text-muted-foreground">{label}</p>
        {action}
      </div>
      {children}
    </Card>
  );
}

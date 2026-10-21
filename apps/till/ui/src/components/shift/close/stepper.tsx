import { Check } from "lucide-react";
import { cn } from "cn";

const closeSteps = ["Count cash", "Card & MoMo", "Result"] as const;

/** Review refund's stepper: done steps carry a tick, the current one is marked for assistive technology. */
export function Stepper({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol aria-label="Steps" className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {closeSteps.map((label, index) => (
        <li
          aria-current={index === current ? "step" : undefined}
          aria-label={label}
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            index > current && "text-muted-foreground",
          )}
          key={label}
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid size-7 place-items-center rounded-full border text-xs tabular-nums",
              index === current && "border-primary bg-primary text-primary-foreground",
              index < current && "border-primary text-primary",
            )}
          >
            {index < current ? <Check className="size-4" /> : index + 1}
          </span>
          <span aria-hidden="true">{label}</span>
        </li>
      ))}
    </ol>
  );
}

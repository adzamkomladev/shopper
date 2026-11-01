import { cn } from "cn";

/**
 * Six boxes over one real input: digits pop in as they arrive, the next box carries the caret, and a wrong code
 * shakes the row (the parent keys it on the attempt). The input above them is what people type and paste into.
 */
export function CodeSlots({
  code,
  invalid,
  disabled,
  children,
}: {
  code: string;
  invalid: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("group relative", invalid && "animate-shake")}>
      <div aria-hidden className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, index) => {
          const digit = code[index];
          const active = !disabled && index === Math.min(code.length, 5);
          return (
            <span
              key={index}
              className={cn(
                "flex aspect-square items-center justify-center rounded-2xl border-2 bg-background text-3xl font-extrabold tabular-nums transition duration-150",
                active &&
                  "group-focus-within:border-primary group-focus-within:ring-4 group-focus-within:ring-primary/15",
                digit && "border-foreground/20",
                invalid && "border-destructive ring-destructive/15",
                disabled && "opacity-60",
              )}
            >
              {digit ? (
                <span key={digit} className="animate-pop">
                  {digit}
                </span>
              ) : active ? (
                <span className="h-8 w-0.5 animate-pulse rounded-full bg-primary" />
              ) : null}
            </span>
          );
        })}
      </div>
      {children}
    </div>
  );
}

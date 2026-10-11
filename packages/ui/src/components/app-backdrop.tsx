import { cn } from "cn";

/** Teal page backdrop with the 20px rounded white panel the Figma shell sits in. */
export function AppBackdrop({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className="bg-backdrop flex min-h-svh p-5" {...props}>
      <div className={cn("flex-1 rounded-panel bg-background px-13 py-10 shadow-sm", className)}>
        {children}
      </div>
    </div>
  );
}

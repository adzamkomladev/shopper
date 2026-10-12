import { cn } from "cn";

type Props = React.ComponentProps<"div"> & {
  /** Fits the viewport exactly, so the content scrolls inside the panel instead of the page. */
  fill?: boolean;
};

/** Teal page backdrop with the 20px rounded white panel the Figma shell sits in. */
export function AppBackdrop({ className, children, fill, ...props }: Props) {
  return (
    <div className={cn("bg-backdrop flex p-5", fill ? "h-svh" : "min-h-svh")} {...props}>
      <div
        className={cn(
          "min-w-0 flex-1 rounded-panel bg-background px-13 py-10 shadow-sm",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

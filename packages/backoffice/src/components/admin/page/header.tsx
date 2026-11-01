import { Button } from "@shopper/ui/components/button";

type Props = {
  title: string;
  /** Secondary buttons, shown before the primary action. */
  children?: React.ReactNode;
  /** The primary action; leave it out when the screen shows its own call to action instead. */
  action?: {
    label: string;
    shortcut: string;
    onClick: () => void;
    ref?: React.Ref<HTMLButtonElement>;
  };
};

/** The heading row every administration screen starts with, with its one primary button. */
export function PageHeader({ title, action, children }: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-3">
        {children}
        {action && (
          <Button aria-keyshortcuts={action.shortcut} ref={action.ref} onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

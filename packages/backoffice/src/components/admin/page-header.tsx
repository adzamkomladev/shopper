import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";

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
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="flex items-center gap-3">
        {children}
        {action && (
          <Button ref={action.ref} onClick={action.onClick}>
            {action.label}
            <Kbd aria-hidden>{action.shortcut}</Kbd>
          </Button>
        )}
      </div>
    </div>
  );
}

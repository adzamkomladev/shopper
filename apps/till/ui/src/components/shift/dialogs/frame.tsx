import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@shopper/ui/components/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { FieldError } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";

/** The shape every shift dialog shares: a title, its fields, any refusal, then Cancel and the one action. */
export function DialogFrame({
  title,
  description,
  problem,
  block,
  pending,
  action,
  summary,
  children,
  onCancel,
}: {
  title: string;
  description: string;
  /** The host's refusal, shown above the buttons. */
  problem: string | null;
  /** Why the action is disabled, or null when it is ready. */
  block: string | null;
  pending: boolean;
  action: string;
  /** Stays in view above the buttons, like a running total. */
  summary?: ReactNode;
  children: ReactNode;
  onCancel: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {children}
      <div className="sticky -bottom-6 -mx-6 -mb-6 grid gap-3 border-t bg-background px-6 py-4">
        {summary}
        {problem && <FieldError>{problem}</FieldError>}
        {block && (
          <p className="text-sm text-muted-foreground" id="shift-dialog-block">
            {block}
          </p>
        )}
        <DialogFooter>
          <Button
            aria-keyshortcuts="Escape"
            onClick={onCancel}
            size="touch"
            type="button"
            variant="outline"
          >
            Cancel <Kbd>Esc</Kbd>
          </Button>
          <Button
            aria-describedby={block ? "shift-dialog-block" : undefined}
            aria-keyshortcuts="Control+Enter"
            disabled={!!block || pending}
            size="touch"
            type="submit"
          >
            {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
            {action} <Kbd className="max-sm:hidden">Ctrl+Enter</Kbd>
          </Button>
        </DialogFooter>
      </div>
    </>
  );
}

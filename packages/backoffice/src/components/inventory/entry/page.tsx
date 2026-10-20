import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { focusOnMount } from "../../../lib/focus";

type Props = {
  title: string;
  description: string;
  branchId: string;
  /** Mod+Enter saves and Escape goes back, wherever focus is inside the page. */
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  shortcuts: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
};

/** The back link, heading and shortcuts shared by Receive and Adjust. */
export function EntryPage({ title, description, branchId, onKeyDown, shortcuts, children }: Props) {
  return (
    <div ref={shortcuts} onKeyDown={onKeyDown} className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3 self-start text-muted-foreground"
        >
          <Link to="/stock/records" search={{ branch: branchId }}>
            <ArrowLeftIcon aria-hidden />
            Back to records
          </Link>
        </Button>
        <div className="flex flex-col gap-1">
          {/* Focused on arrival, so the page's shortcuts work straight after navigating here. */}
          <h1
            tabIndex={-1}
            ref={focusOnMount}
            className="text-3xl font-bold tracking-tight wrap-break-word outline-none"
          >
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

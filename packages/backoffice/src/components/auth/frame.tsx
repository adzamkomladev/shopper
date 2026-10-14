import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Card, CardContent } from "@shopper/ui/components/card";

/** The teal backdrop and white card every signed-out screen sits in, as in the Figma login frame. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppBackdrop className="grid place-items-center bg-transparent p-0 shadow-none">
      <main className="w-full max-w-3xl">
        <Card className="min-h-153 justify-center rounded-3xl border-0">{children}</Card>
      </main>
    </AppBackdrop>
  );
}

type PanelProps = {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
};

/** Brand, one visible h1 and a short lead, then the screen's own content. */
export function AuthPanel({ title, description, children }: PanelProps) {
  return (
    <CardContent className="flex flex-col gap-9 px-6 sm:px-22">
      <div className="flex flex-col gap-5">
        <p aria-hidden className="text-4xl font-semibold tracking-tight text-primary">
          Shopper
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-lg font-medium text-muted-foreground">{description}</p>}
      </div>
      {children}
    </CardContent>
  );
}

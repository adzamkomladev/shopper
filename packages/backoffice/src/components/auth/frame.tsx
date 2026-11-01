import { Card, CardContent } from "@shopper/ui/components/card";

/** The teal backdrop and the compact card every signed-out screen sits in. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-backdrop grid min-h-svh place-items-center p-4">
      <main className="w-full max-w-sm">
        <Card className="gap-0 border-0 py-0 shadow-lg">{children}</Card>
      </main>
    </div>
  );
}

type PanelProps = {
  title: string;
  /** The shop or app this card signs in to, beside the wordmark. */
  place?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
};

/** Brand, one visible h1 and a short lead, then the screen's own content. */
export function AuthPanel({ title, place, description, children }: PanelProps) {
  return (
    <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-col gap-1.5">
        <AuthBrand place={place} />
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </CardContent>
  );
}

/** The mark and wordmark at the head of the card (decorative: the h1 names the screen), and the place. */
export function AuthBrand({ place }: { place?: string }) {
  return (
    <div className="mb-4 flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
      >
        S
      </span>
      <span aria-hidden className="text-base font-semibold tracking-tight">
        Shopper
      </span>
      {place && <span className="truncate text-sm text-muted-foreground">· {place}</span>}
    </div>
  );
}

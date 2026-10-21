import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";

type Props = {
  /** Set when the document has no products. */
  lines?: string;
  /** A refusal that names no field, or a network failure. */
  error?: Error | null;
};

/** What stopped a save that no field explains: no products, or the server's own message. */
export function SaveProblem({ lines, error }: Props) {
  if (!lines && !error) return null;
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>{lines ?? "Couldn't save"}</AlertTitle>
      <AlertDescription>
        {lines ? "Scan or search for a product to put on this document." : error?.message}
      </AlertDescription>
    </Alert>
  );
}

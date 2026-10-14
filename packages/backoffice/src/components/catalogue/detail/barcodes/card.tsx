import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import { FieldGroup } from "@shopper/ui/components/field";
import { Separator } from "@shopper/ui/components/separator";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { TextField } from "../../../fields/text";
import { focusFirstInvalid } from "../../../../lib/focus";
import {
  barcodeSchema,
  BARCODE_FIELDS,
  failureFor,
  emptyBarcode,
  failureMessage,
} from "../../../../schemas/product";
import {
  useAddBarcode,
  useRemoveBarcode,
  type ProductDetail,
} from "../../../../queries/catalogue/detail";

const OFFLINE_NOTE_ID = "barcodes-offline-note";
const UNITS_PER_EACH = 1000;

export function BarcodesCard({ product }: { product: ProductDetail }) {
  const online = useOnline();
  const remove = useRemoveBarcode(product.id);
  const offlineNote = online ? undefined : OFFLINE_NOTE_ID;
  return (
    <Card role="region" aria-labelledby="barcodes-title">
      <CardHeader>
        <CardTitle id="barcodes-title" role="heading" aria-level={2}>
          Barcodes
        </CardTitle>
        <CardDescription>
          Scanning any of these finds this product. A pack barcode sells several at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {product.barcodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No barcodes yet. Add the code printed on the pack.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {product.barcodes.map((barcode) => (
              <li key={barcode.code} className="flex items-center gap-3 py-2 pr-2 pl-4">
                <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="font-medium tabular-nums">{barcode.code}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {packLabel(barcode.quantityThousandths)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove barcode ${barcode.code}`}
                  aria-describedby={offlineNote}
                  disabled={!online || remove.isPending}
                  onClick={() => remove.mutate(barcode)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Separator />
        <AddBarcodeForm productId={product.id} online={online} />
        {!online && (
          <p id={OFFLINE_NOTE_ID} className="text-sm text-muted-foreground">
            You're offline. Reconnect to change barcodes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AddBarcodeForm({ productId, online }: { productId: string; online: boolean }) {
  const form = useForm({
    defaultValues: emptyBarcode,
    validators: { onSubmit: barcodeSchema },
    onSubmit: ({ value }) => {
      if (online) add.mutate(value);
    },
    onSubmitInvalid: focusFirstInvalid,
  });
  const add = useAddBarcode(productId, () => {
    form.reset();
    document.getElementById("code")?.focus();
  });
  const clearError = () => {
    if (add.isError) add.reset();
  };
  const failure = (...names: string[]) => failureFor(add.error, ...names);
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="code">
          {(field) => (
            <TextField
              field={field}
              label="Barcode"
              autoComplete="off"
              inputMode="numeric"
              serverError={failure("code", "barcodes")}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="quantity">
          {(field) => (
            <TextField
              field={field}
              label="Pack quantity"
              inputMode="numeric"
              autoComplete="off"
              serverError={failure("quantityThousandths")}
              onChange={clearError}
            />
          )}
        </form.Field>
      </FieldGroup>
      {add.error && !failureFor(add.error, ...BARCODE_FIELDS) && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{failureMessage(add.error)}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        variant="outline"
        className="self-end"
        disabled={!online || add.isPending}
        aria-describedby={online ? undefined : OFFLINE_NOTE_ID}
      >
        {add.isPending ? "Adding…" : "Add barcode"}
      </Button>
    </form>
  );
}

const packLabel = (quantityThousandths: number) =>
  quantityThousandths === UNITS_PER_EACH ? "Single" : `Pack of ${formatPack(quantityThousandths)}`;

/** 24000 -> "24", 1500 -> "1.5": thousandths printed with integer math only. */
function formatPack(quantityThousandths: number) {
  const whole = Math.trunc(quantityThousandths / UNITS_PER_EACH);
  const fraction = String(quantityThousandths % UNITS_PER_EACH)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

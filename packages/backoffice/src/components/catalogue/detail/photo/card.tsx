import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleAlertIcon, ImageIcon, ImageUpIcon, Trash2Icon } from "lucide-react";
import { MAX_PRODUCT_IMAGE_BYTES } from "@shopper/assets/schemas";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import {
  productImageQuery,
  useRemoveImage,
  useUploadImage,
} from "../../../../queries/catalogue/image";
import type { ProductDetail } from "../../../../queries/catalogue/detail";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * The photo the online store shows. It goes straight to storage and is linked once the API has checked it.
 * I chooses a photo when the shopper may change the product.
 */
export function PhotoCard({ product, canWrite }: { product: ProductDetail; canWrite: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadImage(product.id);
  const remove = useRemoveImage(product.id);
  const [refused, setRefused] = useState<string | null>(null);
  const link = useQuery({
    ...productImageQuery(product.id, product.imageAssetId ?? ""),
    enabled: Boolean(product.imageAssetId),
  });
  const busy = upload.isPending || remove.isPending;
  const shortcuts = useShortcuts(canWrite && !busy ? { I: () => input.current?.click() } : {});
  const failure = refused ?? (upload.error ?? remove.error)?.message ?? null;
  const choose = (file: File | undefined) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setRefused("Choose a JPEG, PNG or WebP photo.");
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) return setRefused("Choose a photo of 2 MB or less.");
    setRefused(null);
    upload.mutate(file);
  };
  return (
    <Card ref={shortcuts} role="region" aria-labelledby="photo-title">
      <CardHeader>
        <CardTitle id="photo-title" role="heading" aria-level={2}>
          Photo
        </CardTitle>
        <CardDescription>Shown on the online store. JPEG, PNG or WebP, up to 2 MB.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative size-32 shrink-0 overflow-hidden rounded-lg border bg-muted">
          {product.imageAssetId && link.data?.url ? (
            <img
              src={link.data.url}
              alt={`Photo of ${product.name}`}
              className="size-full object-cover"
            />
          ) : product.imageAssetId && link.isPending ? (
            <Skeleton className="size-full rounded-none" />
          ) : (
            <ImageIcon
              aria-hidden
              className="absolute inset-0 m-auto size-8 text-muted-foreground"
            />
          )}
        </div>
        <div className="flex flex-col gap-3">
          {product.imageAssetId ? null : (
            <p className="text-sm text-muted-foreground">
              No photo yet. The store shows a placeholder.
            </p>
          )}
          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={input}
                type="file"
                accept={TYPES.join(",")}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  choose(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <Button
                variant="outline"
                disabled={busy}
                aria-keyshortcuts="I"
                onClick={() => input.current?.click()}
              >
                <ImageUpIcon aria-hidden />
                {upload.isPending
                  ? "Uploading…"
                  : product.imageAssetId
                    ? "Replace photo"
                    : "Add a photo"}
              </Button>
              {product.imageAssetId ? (
                <Button variant="ghost" disabled={busy} onClick={() => remove.mutate()}>
                  <Trash2Icon aria-hidden />
                  {remove.isPending ? "Removing…" : "Remove"}
                </Button>
              ) : null}
            </div>
          ) : null}
          {failure ? (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden />
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

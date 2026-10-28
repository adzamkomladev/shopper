import { useRef, useState } from "react";
import type { AnyFieldApi } from "@tanstack/react-form";
import { FileCheckIcon, UploadIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { MAX_KYB_BYTES } from "@shopper/assets/schemas";
import { useUploadKybFile } from "../../queries/kyb";

const ACCEPT = "application/pdf,image/jpeg,image/png";

type Props = { field: AnyFieldApi; label: string; disabled?: boolean };

/** A scan or certificate: the bytes go straight to storage, and the field keeps the asset id they were stored as. */
export function UploadField({ field, label, disabled }: Props) {
  const online = useOnline();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadKybFile();
  const [name, setName] = useState<string>();
  const [tooBig, setTooBig] = useState(false);
  const message =
    (tooBig ? "Choose a file of 5 MB or less" : upload.error?.message) ??
    field.state.meta.errors[0]?.message;
  const errorId = `${field.name}-error`;
  const hintId = `${field.name}-hint`;
  const choose = (file: File | undefined) => {
    if (!file) return;
    setTooBig(file.size > MAX_KYB_BYTES);
    if (file.size > MAX_KYB_BYTES) return upload.reset();
    upload.mutate(file, {
      onSuccess: (assetId) => {
        setName(file.name);
        field.handleChange(assetId);
      },
    });
  };
  const stored = Boolean(field.state.value);
  return (
    <Field data-invalid={!!message}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        // Opened by the button below; hidden outright, since a visually hidden input still takes up width.
        hidden
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          id={field.name}
          type="button"
          variant="outline"
          disabled={disabled || !online}
          // Busy, not disabled: a disabled button drops focus, and the form's shortcuts with it.
          aria-disabled={upload.isPending || undefined}
          aria-invalid={!!message}
          aria-describedby={[message && errorId, hintId].filter(Boolean).join(" ")}
          onClick={() => !upload.isPending && input.current?.click()}
        >
          <UploadIcon aria-hidden />
          {upload.isPending ? "Uploading…" : stored ? "Replace file" : "Choose file"}
        </Button>
        {stored && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileCheckIcon aria-hidden className="size-4 text-primary" />
            {name ?? "Uploaded"}
          </span>
        )}
      </div>
      <FieldDescription id={hintId}>A PDF, JPEG or PNG of 5 MB or less.</FieldDescription>
      {message && <FieldError id={errorId}>{message}</FieldError>}
    </Field>
  );
}

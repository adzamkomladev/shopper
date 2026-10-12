import { useRef, useState } from "react";
import { UploadIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldDescription, FieldError } from "@shopper/ui/components/field";
import { MAX_FILE_BYTES } from "./queries";

const ACCEPT = ".csv,.xlsx,.xls";
const SHEET_NAME = /\.(csv|xlsx|xls)$/i;
const KB = 1024;
const MB = KB * KB;

type Props = {
  file: File | null;
  onChoose: (file: File | null) => void;
  disabled: boolean;
};

/** A drop zone around a native file input: dropping a file and picking one end up in the same place. */
export function FileDrop({ file, onChoose, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<string>();

  function choose(files: FileList | null) {
    const picked = files?.[0] ?? null;
    const problem = picked && rejectionOf(picked);
    setRejection(problem || undefined);
    if (problem && input.current) input.current.value = "";
    onChoose(problem ? null : picked);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const { files } = event.dataTransfer;
        if (disabled || !input.current || files.length === 0) return;
        if (files.length > 1) {
          setRejection("Drop one file at a time.");
          return;
        }
        // Setting the input's files keeps one source of truth, the input a keyboard user would use.
        input.current.files = files;
        choose(input.current.files);
      }}
      data-dragging={dragging}
      className="flex flex-col items-center gap-6 rounded-xl border border-dashed bg-card px-6 py-10 text-center transition-colors data-[dragging=true]:border-primary data-[dragging=true]:bg-accent"
    >
      <span className="grid size-10 place-items-center rounded-lg border bg-background text-muted-foreground">
        <UploadIcon aria-hidden className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium">Drop a spreadsheet here</p>
        <p className="text-sm text-muted-foreground">
          or choose one. CSV, XLSX or XLS, up to 10 MB.
        </p>
      </div>
      <Field data-invalid={!!rejection} className="max-w-sm items-center text-center">
        {/* The native input stays in the page for keyboards and screen readers; its own "No file
            chosen" text would repeat the description below, so a label styled as a button fronts it. */}
        <input
          ref={input}
          id="spreadsheet"
          type="file"
          accept={ACCEPT}
          disabled={disabled}
          aria-invalid={!!rejection}
          aria-describedby={rejection ? "spreadsheet-file spreadsheet-error" : "spreadsheet-file"}
          onChange={(event) => choose(event.target.files)}
          className="peer sr-only"
        />
        <Button
          asChild
          variant="outline"
          className="peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50"
        >
          <label htmlFor="spreadsheet">Choose spreadsheet</label>
        </Button>
        <FieldDescription id="spreadsheet-file">
          {file ? `${file.name} (${sizeOf(file.size)})` : "No file chosen yet."}
        </FieldDescription>
        {rejection && <FieldError id="spreadsheet-error">{rejection}</FieldError>}
      </Field>
    </div>
  );
}

function rejectionOf(file: File) {
  if (!SHEET_NAME.test(file.name)) return "Choose a .csv, .xlsx or .xls file.";
  if (file.size > MAX_FILE_BYTES)
    return "That file is larger than 10 MB. Split it into smaller files.";
  return "";
}

/** Whole units only: 1536 -> "2 KB", 2.5 MB -> "2.5 MB", so no float ever prints. */
function sizeOf(bytes: number) {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / KB)} KB`;
  const tenths = Math.round((bytes * 10) / MB);
  return `${Math.trunc(tenths / 10)}.${tenths % 10} MB`;
}

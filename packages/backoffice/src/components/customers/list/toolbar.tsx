import { DownloadIcon, SearchIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@shopper/ui/components/input-group";
import { Kbd } from "@shopper/ui/components/kbd";

type Props = {
  text: string;
  onTextChange: (text: string) => void;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  searchRef: React.Ref<HTMLInputElement>;
  onDownload: () => void;
  downloading: boolean;
};

/** Search and the CSV download, each with its key. */
export function CustomersToolbar(props: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <InputGroup className="min-w-0 flex-1 basis-64">
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          ref={props.searchRef}
          value={props.text}
          onChange={(event) => props.onTextChange(event.target.value)}
          onKeyDown={props.onSearchKeyDown}
          placeholder="Name, phone or TIN"
          aria-label="Search customers"
        />
        <InputGroupAddon align="inline-end">
          <Kbd aria-hidden>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
      <Button variant="outline" disabled={props.downloading} onClick={props.onDownload}>
        <DownloadIcon aria-hidden />
        {props.downloading ? "Preparing…" : "Download CSV"}
        {!props.downloading && <Kbd aria-hidden>D</Kbd>}
      </Button>
    </div>
  );
}

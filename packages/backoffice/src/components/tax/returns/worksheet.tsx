import { money } from "@shopper/money";
import { Money } from "@shopper/ui/components/money";
import type { VatReturnView } from "../../../schemas/tax/returns";

type Line = { label: string; amount: number; strong?: boolean };

function Section({ title, lines }: { title: string; lines: Line[] }) {
  const id = `return-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="rounded-lg border">
      <h2 id={id} className="border-b px-4 py-3 text-sm font-semibold">
        {title}
      </h2>
      <dl className="divide-y">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className={line.strong ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>
              {line.label}
            </dt>
            <dd className={line.strong ? "font-semibold whitespace-nowrap" : "whitespace-nowrap"}>
              <Money amount={money(line.amount)} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The input tax claimed, for a member who may read the return but not file it. */
export function InputTax({ input }: { input: VatReturnView["input"] }) {
  return (
    <Section
      title="Input tax claimed"
      lines={[
        { label: "Input VAT", amount: input.vat },
        { label: "Input NHIL", amount: input.nhil },
        { label: "Input GETFund levy", amount: input.getfund },
      ]}
    />
  );
}

/** The month's return in filing order: supplies, output tax less credit notes, input tax, and the balance. */
export function Worksheet({
  worksheet,
  input,
}: {
  worksheet: VatReturnView;
  input: React.ReactNode;
}) {
  const { output, creditNotes } = worksheet;
  const outputTotal = output.vat + output.nhil + output.getfund + output.covid;
  const credit = worksheet.payable < 0;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Section
          title="Supplies"
          lines={[
            { label: "Standard-rated, before tax", amount: worksheet.standard.value },
            { label: "Zero-rated", amount: worksheet.zeroRated },
            { label: "Exempt", amount: worksheet.exempt },
            { label: "Credit notes, standard-rated", amount: -creditNotes.value },
            { label: "Credit notes, zero-rated", amount: -creditNotes.zeroRated },
            { label: "Credit notes, exempt", amount: -creditNotes.exempt },
          ]}
        />
        <Section
          title="Output tax, less credit notes"
          lines={[
            { label: "VAT", amount: output.vat },
            { label: "NHIL", amount: output.nhil },
            { label: "GETFund levy", amount: output.getfund },
            ...(output.covid ? [{ label: "COVID-19 levy", amount: output.covid }] : []),
            { label: "Output tax", amount: outputTotal, strong: true },
          ]}
        />
      </div>
      <div className="flex flex-col gap-6">
        {input}
        <Section
          title="Balance"
          lines={[
            {
              label: credit ? "Credit to carry forward" : "Net payable to GRA",
              amount: credit ? -worksheet.payable : worksheet.payable,
              strong: true,
            },
          ]}
        />
      </div>
    </div>
  );
}

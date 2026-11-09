export type EmailBlock =
  | { kind: "text"; text: string }
  /** Label and value per row; `note` is the comparison under the value (yesterday, the share). */
  | {
      kind: "facts";
      title?: string;
      rows: readonly { label: string; value: string; note?: string }[];
    }
  /** Identifiers that must be read exactly, such as hash chain heads: label over a monospaced, wrapping value. */
  | { kind: "records"; rows: readonly { label: string; value: string }[] }
  | { kind: "list"; title?: string; items: readonly string[] }
  | { kind: "notice"; text: string };

export interface EmailContent {
  /** The inbox preview line: what the email is for, in one sentence. */
  preheader: string;
  /** The shop the email is about, shown above the heading. Absent for platform mail. */
  shop?: string;
  heading: string;
  blocks: readonly EmailBlock[];
  /** The one thing to do. An email without one is only to be read. */
  action?: { label: string; url: string };
  footnote?: string;
}

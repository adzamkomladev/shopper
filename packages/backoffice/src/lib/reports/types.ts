/** A report's period: one shop day (the dashboard) or a range of them, and how to step it. */
export type Period =
  | { kind: "day"; day: string; onDay: (day: string) => void; onStep: (direction: -1 | 1) => void }
  | {
      kind: "range";
      from: string;
      to: string;
      onRange: (range: { from: string; to: string }) => void;
      onStep: (direction: -1 | 1) => void;
    };

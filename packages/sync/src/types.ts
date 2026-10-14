export type LiveSocket = {
  on(event: "open" | "close" | "error", listener: () => void): unknown;
  on(event: "message", listener: (data: unknown) => void): unknown;
  close(): void;
};
export type LiveMode = "live" | "polling" | "offline";

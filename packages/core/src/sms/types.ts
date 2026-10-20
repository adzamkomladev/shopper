import type { createArkesel } from "./arkesel";

export type ArkeselOptions = {
  apiKey: string;
  sender: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};
export type Sms = ReturnType<typeof createArkesel>;

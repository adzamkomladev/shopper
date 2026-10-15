import type { Money } from "@shopper/money";
import type { MomoNetwork } from "./schemas/base";

export type PaystackOptions = {
  secretKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export type PaystackCharge = {
  reference: string;
  amount: Money;
  phone: string;
  network: MomoNetwork;
  email: string;
};

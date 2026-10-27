export type HubtelOptions = {
  clientId: string;
  clientSecret: string;
  /** The POS sales id of the merchant account that receives the money. */
  merchantAccount: string;
  /** Where Hubtel POSTs the outcome: the shared API's `/webhooks/hubtel`. */
  callbackUrl: string;
  baseUrl?: string;
  statusUrl?: string;
  fetch?: typeof fetch;
};

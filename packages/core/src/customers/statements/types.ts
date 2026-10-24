import type { ShopperDatabase } from "@shopper/db-pg";
import type { Renderer } from "@shopper/ports";
import type { Sms } from "../../sms/types";

/** Sends one email and answers the provider's reference; `createMaileroo` fits. */
export type StatementMail = (message: {
  email: string;
  subject: string;
  link: string;
  plain: string;
  attachments: { fileName: string; contentType: string; content: Uint8Array }[];
}) => Promise<string | undefined>;

/** What the consumer needs from its shell. A missing channel is a failed delivery, retried, never a silent skip. */
export interface StatementDeliveryDeps {
  db: ShopperDatabase;
  appVersion: string;
  /** Signs the customer link, and the public origin it points at; without them a statement cannot be sent. */
  linkSecret?: string;
  baseUrl?: string;
  sms?: Sms;
  mail?: StatementMail;
  renderer?: Renderer;
}

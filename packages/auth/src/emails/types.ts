export interface MailerooOptions {
  apiKey: string;
  from: string;
  endpoint?: string;
}
/** `plain` replaces the default body, which is the subject and the `link`. */
export interface MailMessage {
  email: string;
  subject: string;
  link: string;
  plain?: string;
  attachments?: { fileName: string; contentType: string; content: Uint8Array }[];
}

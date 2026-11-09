import { emailColors as c } from "./tokens";
import type { EmailBlock, EmailContent } from "./types";

const font = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
// Light values inline for every client; the dark values ride on classes that only `prefers-color-scheme` reaches.
const dark = (cls: string, property: string, key: keyof typeof c) =>
  `.${cls}{${property}:${c[key].dark} !important}`;

/**
 * One email, two parts: HTML built from `@shopper/ui` tokens for the inbox, and the same content as plain text for
 * clients and filters that want none. Senders pass content, never markup; every string is escaped here.
 */
export function renderEmail(email: EmailContent) {
  const action = email.action && { label: email.action.label, url: httpUrl(email.action.url) };
  return { html: html(email, action), plain: plain(email, action) };
}

function html(email: EmailContent, action?: { label: string; url: string }) {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(email.heading)}</title>
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%}
table{border-collapse:collapse}
a{color:${c.primary.light}}
@media (max-width:600px){.pad{padding:24px 20px !important}.h1{font-size:20px !important;line-height:26px !important}}
@media (prefers-color-scheme:dark){
${[
  dark("bg-page", "background-color", "page"),
  dark("bg-card", "background-color", "background"),
  dark("bd", "border-color", "border"),
  dark("tx", "color", "foreground"),
  dark("mu", "color", "mutedForeground"),
  dark("lk", "color", "primary"),
  dark("btn", "background-color", "primary"),
  dark("btn-tx", "color", "primaryForeground"),
  dark("warn", "background-color", "warning"),
  dark("warn", "border-color", "warningBorder"),
  dark("warn-tx", "color", "warningForeground"),
].join("\n")}
}
</style>
</head>
<body class="bg-page" style="margin:0;background-color:${c.page.light}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${c.page.light}">${esc(email.preheader)}${"&nbsp;&zwnj;".repeat(40)}</div>
<table role="presentation" width="100%" class="bg-page" style="background-color:${c.page.light}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="560" style="width:100%;max-width:560px">
<tr><td style="padding:0 4px 16px;font:600 15px/20px ${font};color:${c.primary.light}" class="lk">Shopper</td></tr>
<tr><td class="pad bg-card bd" style="padding:32px;background-color:${c.background.light};border:1px solid ${c.border.light};border-radius:8px;font-family:${font}">
${email.shop ? `<p class="mu" style="margin:0 0 4px;font:400 14px/20px ${font};color:${c.mutedForeground.light}">${esc(email.shop)}</p>` : ""}
<h1 class="h1 tx" style="margin:0 0 20px;font:600 24px/30px ${font};color:${c.foreground.light}">${esc(email.heading)}</h1>
${email.blocks.map(block).join("\n")}
${action ? button(action) : ""}
</td></tr>
<tr><td class="mu" style="padding:16px 4px 0;font:400 13px/20px ${font};color:${c.mutedForeground.light}">${email.footnote ? `${esc(email.footnote)}<br>` : ""}Sent by Shopper, point of sale for Ghanaian shops.</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

function block(item: EmailBlock) {
  if (item.kind === "text")
    return `<p class="tx" style="margin:0 0 16px;font:400 15px/24px ${font};color:${c.foreground.light}">${esc(item.text)}</p>`;
  if (item.kind === "notice")
    return `<table role="presentation" width="100%" style="margin:0 0 16px"><tr><td class="warn warn-tx" style="padding:12px 16px;background-color:${c.warning.light};border:1px solid ${c.warningBorder.light};border-radius:6px;font:400 14px/20px ${font};color:${c.warningForeground.light}">${esc(item.text)}</td></tr></table>`;
  if (item.kind === "records")
    return `<table role="presentation" width="100%" style="margin:0 0 20px">${item.rows
      .map(
        (row, index) =>
          `<tr><td class="bd" style="padding:12px 0;${index ? `border-top:1px solid ${c.border.light};` : ""}font:400 13px/20px ${font};color:${c.mutedForeground.light}"><span class="mu">${esc(row.label)}</span><br><code class="tx" style="font:400 13px/20px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${c.foreground.light};word-break:break-all">${esc(row.value)}</code></td></tr>`,
      )
      .join("")}</table>`;
  if (item.kind === "list")
    return `${item.title ? `<p class="mu" style="margin:0 0 8px;font:600 13px/20px ${font};color:${c.mutedForeground.light}">${esc(item.title)}</p>` : ""}<ul class="tx" style="margin:0 0 16px;padding:0 0 0 20px;font:400 15px/24px ${font};color:${c.foreground.light}">${item.items.map((entry) => `<li>${esc(entry)}</li>`).join("")}</ul>`;
  return `${item.title ? `<p class="mu" style="margin:8px 0 0;font:600 13px/20px ${font};color:${c.mutedForeground.light}">${esc(item.title)}</p>` : ""}<table role="presentation" width="100%" style="margin:0 0 20px">${item.rows
    .map(
      (row, index) =>
        `<tr><td class="bd" style="padding:12px 0;${index ? `border-top:1px solid ${c.border.light};` : ""}font:400 14px/20px ${font};color:${c.mutedForeground.light}"><span class="mu">${esc(row.label)}</span></td><td class="bd" align="right" style="padding:12px 0;${index ? `border-top:1px solid ${c.border.light};` : ""}font:600 15px/20px ${font};font-variant-numeric:tabular-nums"><span class="tx" style="color:${c.foreground.light}">${esc(row.value)}</span>${row.note ? `<br><span class="mu" style="font:400 13px/18px ${font};color:${c.mutedForeground.light}">${esc(row.note)}</span>` : ""}</td></tr>`,
    )
    .join("")}</table>`;
}

function button(action: { label: string; url: string }) {
  return `<table role="presentation" style="margin:8px 0 20px"><tr><td class="btn" style="background-color:${c.primary.light};border-radius:6px"><a href="${esc(action.url)}" class="btn-tx" style="display:inline-block;padding:14px 24px;font:600 15px/20px ${font};color:${c.primaryForeground.light};text-decoration:none">${esc(action.label)}</a></td></tr></table>
<p class="mu" style="margin:0;font:400 13px/20px ${font};color:${c.mutedForeground.light}">Button not working? Paste this link into your browser:<br><a href="${esc(action.url)}" class="lk" style="color:${c.primary.light};word-break:break-all">${esc(action.url)}</a></p>`;
}

function plain(email: EmailContent, action?: { label: string; url: string }) {
  return [
    email.heading,
    ...email.blocks.map((item) => {
      if (item.kind === "text" || item.kind === "notice") return item.text;
      if (item.kind === "records")
        return item.rows.map((row) => `${row.label}: ${row.value}`).join("\n");
      if (item.kind === "list")
        return [item.title, ...item.items.map((entry) => `- ${entry}`)].filter(Boolean).join("\n");
      return [
        item.title,
        ...item.rows.map((row) => `${row.label}: ${row.value}${row.note ? ` (${row.note})` : ""}`),
      ]
        .filter(Boolean)
        .join("\n");
    }),
    action && `${action.label}: ${action.url}`,
    email.footnote,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Only http(s) links are ever written into an email, and always in their normalised, percent-encoded form. */
function httpUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Email links must be http(s)");
  return url.href;
}

const entities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (text: string) => text.replace(/[&<>"']/g, (ch) => entities[ch]!);

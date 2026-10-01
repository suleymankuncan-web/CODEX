import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mailVisualLanguage as v, mailEmoji, type MailIcon } from "./visual-language";

export interface MailContent {
  title: string;
  preheader: string;
  icon: MailIcon;
  layout?: "centered" | "compact";
  greeting?: string;
  paragraphs: string[];
  facts?: { label: string; value: string }[];
  rows?: { primary: string; secondary: string }[];
  action?: { label: string; url: string };
  notice?: { text: string; tone?: "info" | "warning" };
  footnote?: string;
}

export interface RenderedMail {
  html: string;
  text: string;
  attachments: { filename: string; content: Buffer; contentType: string; cid: string }[];
}

export function escapeMailText(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function safeActionUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || [...value].some(char => char.charCodeAt(0) <= 32)) {
    throw new Error("mail_action_url_must_be_https");
  }
  return escapeMailText(value);
}

/** No raw HTML content: all callers provide text and structured fields. */
export function renderMailHtml(content: MailContent, images: { logo: string; icon: string } = {
  logo: "cid:hr-axis-logo", icon: `cid:hr-axis-${content.icon}`,
}): string {
  const e = escapeMailText;
  const p = (text: string) => `<p style="margin:0 0 10px;color:${v.muted};font-size:${v.bodySize}px;line-height:23px;overflow-wrap:anywhere">${e(text)}</p>`;
  const cells = content.facts?.map(f => `<td width="50%" valign="top" style="padding:8px 10px;border-bottom:1px solid ${v.border};overflow-wrap:anywhere"><span style="font-size:12px;line-height:17px;color:${v.muted}">${e(f.label)}</span><br><strong style="font-size:14px;line-height:21px;color:${v.ink}">${e(f.value)}</strong></td>`) ?? [];
  const factRows = cells.filter((_, index) => index % 2 === 0).map((cell, index) => {
    const next = cells[index * 2 + 1];
    if (next) return `<tr>${cell}${next}</tr>`;
    const last = content.facts![index * 2];
    return `<tr><td colspan="2" style="padding:9px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr><td style="font-size:12px;line-height:20px;color:${v.muted};overflow-wrap:anywhere">${e(last.label)}</td><td align="right" style="font-size:14px;line-height:20px;font-weight:700;color:${v.ink};overflow-wrap:anywhere">${e(last.value)}</td></tr></table></td></tr>`;
  }).join("");
  const facts = cells.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${v.info}" style="margin:4px 0 10px;border-radius:12px;table-layout:fixed">${factRows}</table>` : "";
  const rows = content.rows?.map(row => `<tr><td style="padding:9px 0;border-bottom:1px solid ${v.border};overflow-wrap:anywhere"><strong style="font-size:14px;color:${v.ink}">${e(row.primary)}</strong><br><span style="font-size:13px;color:${v.muted};line-height:20px">${e(row.secondary)}</span></td></tr>`).join("");
  const action = content.action ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td align="center" bgcolor="${v.primary}" style="border-radius:12px;background:linear-gradient(125deg,${v.accent},${v.primary})"><a href="${safeActionUrl(content.action.url)}" style="display:block;padding:14px 18px;font-size:16px;line-height:22px;font-weight:600;color:#ffffff;text-decoration:none;overflow-wrap:anywhere">${e(content.action.label)}</a></td></tr></table>` : "";
  const notice = content.notice ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0"><tr><td style="padding:12px 14px;border-radius:12px;background:${content.notice.tone === "warning" ? v.warning : v.info};color:${content.notice.tone === "warning" ? v.warningInk : v.primary};font-size:13px;line-height:20px;overflow-wrap:anywhere">${e(content.notice.text)}</td></tr></table>` : "";
  const title = `<span aria-hidden="true">${mailEmoji[content.icon]}</span> ${e(content.title)}`;
  const heading = content.layout === "centered" || (content.layout === undefined && content.icon === "security")
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><img src="${e(images.icon)}" width="${v.iconSize}" height="${v.iconSize}" alt="" style="display:block;border:0"><h1 style="margin:10px 0 16px;font-size:${v.headingSize}px;line-height:32px;font-weight:700;letter-spacing:-.6px;overflow-wrap:anywhere">${title}</h1></td></tr></table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;table-layout:fixed"><tr><td><h1 style="margin:0;font-size:${v.operationalHeadingSize}px;line-height:28px;font-weight:700;letter-spacing:-.5px;overflow-wrap:anywhere">${title}</h1></td><td width="52" align="right"><img src="${e(images.icon)}" width="${v.operationalIconSize}" height="${v.operationalIconSize}" alt="" style="display:block;border:0"></td></tr></table>`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(content.title)}</title></head><body style="margin:0;background:${v.background};font-family:${v.font};color:${v.ink}">
<div style="display:none;font-size:1px;color:${v.background};max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${e(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${v.background}"><tr><td align="center" style="padding:18px 12px">
<!--[if mso]><table role="presentation" width="${v.width}" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table class="axis-mail-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${v.surface}" style="max-width:${v.width}px;border-radius:${v.radius}px;border:1px solid ${v.border};box-shadow:0 18px 48px rgba(14,33,71,.08);table-layout:fixed"><tr><td style="padding:${v.padding}px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="136"><img src="${e(images.logo)}" width="128" height="40" alt="HR Axis" style="display:block;border:0"></td><td align="right" style="font-size:10px;line-height:16px;color:${v.muted}">Daha iyi<br>insan deneyimleri</td></tr></table>
<div style="border-top:1px solid ${v.border};margin:14px 0"></div>
${heading}
${content.greeting ? `<p style="margin:0 0 10px;font-size:16px;line-height:24px">${e(content.greeting)}</p>` : ""}${content.paragraphs.map(p).join("")}${facts}${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed">${rows}</table>` : ""}${action}${notice}
${content.footnote ? `<p style="margin:16px 0 0;font-size:12px;line-height:19px;color:${v.muted};overflow-wrap:anywhere">${e(content.footnote)}</p>` : ""}
<div style="border-top:1px solid ${v.border};margin:18px 0 12px"></div><p style="margin:0;text-align:center;font-size:11px;line-height:18px;color:${v.muted}">HR Axis · Otomatik sistem bildirimi<br>Daha güçlü ekipler, daha parlak yarınlar</p>
</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}

export function renderBaseTemplate(content: MailContent): RenderedMail {
  const html = renderMailHtml(content);
  const text = [`${mailEmoji[content.icon]} ${content.title}`, content.greeting, ...content.paragraphs,
    ...(content.facts ?? []).map(f => `${f.label}: ${f.value}`),
    ...(content.rows ?? []).map(row => `${row.primary} | ${row.secondary}`),
    content.action ? `${content.action.label}: ${content.action.url}` : undefined,
    content.notice?.text, content.footnote, "HR Axis · Otomatik sistem bildirimi",
  ].filter(Boolean).join("\n\n");
  return { html, text, attachments: ["logo", content.icon].map(name => ({
    filename: `hr-axis-${name}.png`, content: readFileSync(join(__dirname, "assets", `${name}.png`)),
    contentType: "image/png", cid: `hr-axis-${name}`,
  })) };
}

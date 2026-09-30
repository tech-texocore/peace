// Table markup and inline styles: Gmail and Outlook drop <style> blocks and flexbox.

export interface EmailBrand {
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  accent: string;
  accentForeground: string;
  webUrl: string;
  supportEmail: string | null;
  supportPhone: string | null;
  social: { label: string; url: string }[];
}

export interface EmailItem {
  title: string;
  detail?: string | null;
  image?: string | null;
  price?: string | null;
  oldPrice?: string | null;
  url?: string | null;
}

export interface EmailContent {
  preheader: string;
  heading: string;
  greeting?: string | null;
  paragraphs: string[];
  items?: EmailItem[];
  summary?: { label: string; value: string; strong?: boolean }[];
  details?: { label: string; value: string }[];
  cta?: { label: string; url: string };
  note?: string | null;
  reason?: string | null;
  preferencesUrl?: string | null;
  preferencesLabel?: string;
}

const INK = '#201f1b';
const MUTED = '#6f6d63';
const LINE = '#e4ded2';
const CANVAS = '#f4f0e8';
const CARD = '#fbf8f2';
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

export const absoluteUrl = (webUrl: string, path: string) =>
  new URL(path, `${webUrl.replace(/\/$/, '')}/`).toString();

function button(label: string, url: string, b: EmailBrand) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px"><tr><td style="border-radius:999px;background:${b.accent}">
<a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:15px;font-weight:600;color:${b.accentForeground};text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function itemRow(it: EmailItem) {
  const title = it.url
    ? `<a href="${escapeHtml(it.url)}" target="_blank" style="color:${INK};text-decoration:none">${escapeHtml(it.title)}</a>`
    : escapeHtml(it.title);
  const image = it.image
    ? `<img src="${escapeHtml(it.image)}" width="72" height="90" alt="" style="display:block;width:72px;height:90px;object-fit:cover;border-radius:10px;border:1px solid ${LINE}">`
    : `<div style="width:72px;height:90px;border-radius:10px;background:${CANVAS};border:1px solid ${LINE}"></div>`;
  const price = it.price
    ? `<div style="font-family:${SANS};font-size:15px;font-weight:600;color:${INK}">${escapeHtml(it.price)}${it.oldPrice ? ` <span style="font-weight:400;color:${MUTED};text-decoration:line-through;font-size:13px">${escapeHtml(it.oldPrice)}</span>` : ''}</div>`
    : '';
  return `<tr>
<td width="84" valign="top" style="padding:12px 12px 12px 0;border-bottom:1px solid ${LINE}">${it.url ? `<a href="${escapeHtml(it.url)}" target="_blank">${image}</a>` : image}</td>
<td valign="top" style="padding:12px 0;border-bottom:1px solid ${LINE}">
<div style="font-family:${SERIF};font-size:16px;line-height:1.35;color:${INK}">${title}</div>
${it.detail ? `<div style="font-family:${SANS};font-size:13px;color:${MUTED};margin-top:4px">${escapeHtml(it.detail)}</div>` : ''}
<div style="margin-top:8px">${price}</div>
</td></tr>`;
}

export function renderEmail(c: EmailContent, b: EmailBrand): string {
  const header = b.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" alt="${escapeHtml(b.name)}" height="40" style="display:block;height:40px;max-width:220px;margin:0 auto;border:0">`
    : `<div style="font-family:${SERIF};font-size:26px;letter-spacing:6px;color:${INK}">${escapeHtml(b.name.toUpperCase())}</div>`;
  const paragraphs = c.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:${INK}">${escapeHtml(p)}</p>`,
    )
    .join('');
  const items = c.items?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;border-top:1px solid ${LINE}">${c.items.map(itemRow).join('')}</table>`
    : '';
  const summary = c.summary?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px">${c.summary
        .map(
          (
            r,
          ) => `<tr><td style="padding:5px 0;font-family:${SANS};font-size:${r.strong ? 16 : 14}px;color:${r.strong ? INK : MUTED};${r.strong ? 'font-weight:600;border-top:1px solid ' + LINE + ';padding-top:10px' : ''}">${escapeHtml(r.label)}</td>
<td align="right" style="padding:5px 0;font-family:${SANS};font-size:${r.strong ? 16 : 14}px;color:${INK};${r.strong ? 'font-weight:600;border-top:1px solid ' + LINE + ';padding-top:10px' : ''}">${escapeHtml(r.value)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const details = c.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background:${CANVAS};border-radius:12px"><tr><td style="padding:14px 18px">${c.details
        .map(
          (
            d,
          ) => `<div style="font-family:${SANS};font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};margin-top:8px">${escapeHtml(d.label)}</div>
<div style="font-family:${SANS};font-size:14px;line-height:1.5;color:${INK};margin-top:2px">${escapeHtml(d.value).replace(/\n/g, '<br>')}</div>`,
        )
        .join('')}</td></tr></table>`
    : '';
  const contact = [
    b.supportEmail &&
      `<a href="mailto:${escapeHtml(b.supportEmail)}" style="color:${MUTED}">${escapeHtml(b.supportEmail)}</a>`,
    b.supportPhone &&
      `<a href="tel:${escapeHtml(b.supportPhone.replace(/\s/g, ''))}" style="color:${MUTED}">${escapeHtml(b.supportPhone)}</a>`,
  ]
    .filter(Boolean)
    .join(' &nbsp;·&nbsp; ');
  const social = b.social
    .map(
      (s) =>
        `<a href="${escapeHtml(s.url)}" target="_blank" style="color:${MUTED}">${escapeHtml(s.label)}</a>`,
    )
    .join(' &nbsp;·&nbsp; ');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(c.heading)}</title></head>
<body style="margin:0;padding:0;background:${CANVAS}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td align="center" style="padding:8px 0 22px"><a href="${escapeHtml(b.webUrl)}" target="_blank" style="text-decoration:none">${header}</a></td></tr>
<tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:18px;padding:34px 30px">
<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:26px;font-weight:500;line-height:1.25;color:${INK}">${escapeHtml(c.heading)}</h1>
${c.greeting ? `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;color:${INK}">${escapeHtml(c.greeting)}</p>` : ''}
${paragraphs}${items}${summary}${details}
${c.cta ? button(c.cta.label, c.cta.url, b) : ''}
${c.note ? `<p style="margin:18px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED}">${escapeHtml(c.note)}</p>` : ''}
</td></tr>
<tr><td align="center" style="padding:24px 16px 8px;font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED}">
${b.tagline ? `<div style="font-family:${SERIF};font-size:14px;color:${INK};margin-bottom:6px">${escapeHtml(b.tagline)}</div>` : ''}
${contact ? `<div>Need help? ${contact}</div>` : ''}
${social ? `<div>${social}</div>` : ''}
<div style="margin-top:10px"><a href="${escapeHtml(b.webUrl)}" target="_blank" style="color:${MUTED}">${escapeHtml(b.webUrl.replace(/^https?:\/\//, ''))}</a></div>
${c.reason ? `<div style="margin-top:10px">${escapeHtml(c.reason)}${c.preferencesUrl ? ` <a href="${escapeHtml(c.preferencesUrl)}" target="_blank" style="color:${MUTED}">${escapeHtml(c.preferencesLabel ?? 'Manage email preferences')}</a>` : ''}</div>` : ''}
</td></tr>
</table></td></tr></table>
</body></html>`;
}

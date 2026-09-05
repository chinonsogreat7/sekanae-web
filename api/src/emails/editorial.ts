// Shared presentation primitives. Dynamic text and URLs are escaped at the boundary;
// bodyHtml/rows are trusted markup assembled by our email builders or admin editor.
export const palette = { ink: "#231c18", muted: "#6f6259", line: "#e5ded3", gold: "#8b652c", champagne: "#d9c29b", paper: "#f4efe7" };
export const serif = "Georgia,'Times New Roman',serif";
export const sans = "Arial,Helvetica,sans-serif";
export function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
export function safeEmailUrl(value: string | undefined, origin?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value, origin);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
export function siteUrl(origin: string, path: string) {
  return new URL(path, origin).href;
}
export function table(rows: string, style = "") {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;${style}">${rows}</table>`;
}
export function label(text: string, color: string = palette.gold) {
  return `<p style="margin:0;font:11px/1.6 ${sans};letter-spacing:1.6px;text-transform:uppercase;color:${color};overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(text)}</p>`;
}
export function paragraph(text: string) {
  return `<p style="margin:0 0 16px;font:15px/1.8 ${sans};color:${palette.muted};overflow-wrap:anywhere;">${escapeHtml(text)}</p>`;
}
export function section(content: string, background = "#ffffff") {
  return `<tr><td class="email-pad" bgcolor="${background}" style="padding:28px 40px;background:${background};font:15px/1.8 ${sans};color:${palette.muted};overflow-wrap:anywhere;word-break:break-word;">${content}</td></tr>`;
}
export function emailButton(text: string, href: string) {
  const url = safeEmailUrl(href);
  if (!url) return "";
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="${palette.ink}" style="border:1px solid ${palette.ink};text-align:center;"><a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:16px 24px;font:bold 12px/1.5 ${sans};letter-spacing:1px;text-transform:uppercase;text-decoration:none;color:#ffffff;mso-padding-alt:0;"><!--[if mso]><i style="mso-font-width:200%;mso-text-raise:24pt;">&#8203;&emsp;</i><![endif]--><span style="mso-text-raise:12pt;">${escapeHtml(text)}</span><!--[if mso]><i style="mso-font-width:200%;">&emsp;&#8203;</i><![endif]--></a></td></tr></table>`;
}
export type EditorialOptions = {
  title: string;
  accent?: string;
  eyebrow?: string;
  intro?: string;
  preheader?: string;
  rows: string;
  webOrigin: string;
  footerNote?: string;
  unsubscribe?: { url: string; label: string };
};
export function renderEditorialEmail(input: EditorialOptions) {
  const title = `${input.title}${input.accent ? ` ${input.accent}` : ""}`;
  const home = escapeHtml(siteUrl(input.webOrigin, "/"));
  const support = escapeHtml(siteUrl(input.webOrigin, "/client-care"));
  const unsubscribeUrl = safeEmailUrl(input.unsubscribe?.url);
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="x-apple-disable-message-reformatting"/><meta name="color-scheme" content="light"/><title>${escapeHtml(title)}</title><style>
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}img{-ms-interpolation-mode:bicubic;border:0;}a:focus-visible{outline:2px solid #8b652c;outline-offset:4px;}.email-content img{max-width:100%;height:auto;}.email-content a{color:#8b652c;}.email-content h2,.email-content h3{font-family:Georgia,'Times New Roman',serif;color:#231c18;}@media screen and (max-width:480px){.email-outer{padding:0!important;}.email-pad{padding-left:24px!important;padding-right:24px!important;}.email-display{font-size:36px!important;line-height:1.12!important;}.email-stack{display:block!important;width:100%!important;padding:0 0 22px!important;}.email-hero{height:auto!important;}.email-code{font-size:30px!important;letter-spacing:5px!important;}.email-photo{width:70px!important;height:84px!important;}.email-product-copy{padding-left:14px!important;}}
</style></head><body style="margin:0;padding:0;background:#f1eee8;color:${palette.ink};font-family:${sans};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.preheader ?? title)}</div>
${table(`<tr><td align="center" class="email-outer" style="padding:28px 16px;"><!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-collapse:collapse;"><tr><td class="email-pad" bgcolor="${palette.ink}" style="padding:30px 40px;background:${palette.ink};"><a href="${home}" target="_blank" style="font:27px/1.2 ${serif};letter-spacing:6px;color:#e7d9bf;text-decoration:none;">SEKANAE</a></td></tr><tr><td class="email-pad" bgcolor="${palette.ink}" style="padding:8px 40px 34px;background:${palette.ink};">${label(input.eyebrow ?? "From the SEKANAE studio", palette.champagne)}<h1 class="email-display" style="margin:22px 0 16px;font:48px/1.08 ${serif};font-weight:normal;letter-spacing:-1.5px;color:#fbfaf7;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(input.title)}${input.accent ? `<br/><em style="font-weight:normal;color:${palette.champagne};">${escapeHtml(input.accent)}</em>` : ""}</h1>${input.intro ? `<p style="margin:0;font:14px/1.8 ${sans};color:#e5ded3;overflow-wrap:anywhere;">${escapeHtml(input.intro)}</p>` : ""}</td></tr>${input.rows}<tr><td class="email-pad" align="center" style="padding:28px 40px 32px;border-top:1px solid ${palette.line};"><p style="margin:0 0 12px;font:16px/1.5 ${serif};color:${palette.ink};">With care, the SEKANAE studio.</p><p style="margin:0;font:12px/1.8 ${sans};color:${palette.muted};"><a href="${support}" target="_blank" style="color:${palette.ink};text-decoration:underline;">Our client care team is here to help.</a></p><p style="margin:22px 0 0;font:11px/1.8 ${sans};color:${palette.muted};">SEKANAE · Accessories with a global point of view<br/>${escapeHtml(input.footerNote ?? "A service email from SEKANAE.")}</p>${input.unsubscribe && unsubscribeUrl ? `<p style="margin:14px 0 0;font:12px/1.8 ${sans};"><a href="${escapeHtml(unsubscribeUrl)}" style="color:${palette.muted};text-decoration:underline;">${escapeHtml(input.unsubscribe.label)}</a></p>` : ""}</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr>`)}
</body></html>`;
}
export type EmailProduct = { name: string; color: string; quantity: number; lineTotal: number; image?: string; href?: string; giftWrap?: boolean };
export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
}
export function productSections(items: EmailProduct[], currency: string, origin: string) {
  return items.map((item, index) => {
    const image = safeEmailUrl(item.image, origin);
    const href = safeEmailUrl(item.href, origin);
    const name = escapeHtml(item.name);
    const linkedName = href ? `<a href="${escapeHtml(href)}" style="color:${palette.ink};text-decoration:underline;">${name}</a>` : name;
    const copy = `${label(`${String(index + 1).padStart(2, "0")} / Your selection`)}<h2 style="margin:12px 0 8px;font:${index === 0 ? 25 : 21}px/1.3 ${serif};font-weight:normal;color:${palette.ink};overflow-wrap:anywhere;">${linkedName}</h2><p style="margin:0 0 10px;font:12px/1.7 ${sans};color:${palette.muted};">${escapeHtml(item.color)} · Qty ${item.quantity}${item.giftWrap ? "<br/>Gift packaging requested" : ""}</p><p style="margin:0;font:14px/1.6 ${sans};color:${palette.ink};">${formatAmount(item.lineTotal, currency)}</p>`;
    if (index === 0) return (image ? `<tr><td bgcolor="${palette.paper}" style="background:${palette.paper};"><img class="email-hero" src="${escapeHtml(image)}" width="600" height="360" alt="${escapeHtml(item.name)}" style="display:block;width:100%;max-width:600px;height:360px;object-fit:cover;background:${palette.paper};color:${palette.muted};font:14px/1.5 ${sans};"/></td></tr>` : "") + section(copy);
    return section(table(`<tr>${image ? `<td width="100" valign="top"><img class="email-photo" src="${escapeHtml(image)}" width="100" height="120" alt="${escapeHtml(item.name)}" style="display:block;width:100px;height:120px;object-fit:cover;background:${palette.paper};"/></td>` : ""}<td class="email-product-copy" valign="middle" style="${image ? "padding-left:22px;" : ""}">${copy}</td></tr>`));
  }).join("");
}

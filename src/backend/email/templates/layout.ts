// Shared branded layout for the two transactional emails. Table-based + inline styles
// for compatibility with Gmail/Outlook. Every dynamic value must go through `esc()`.

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const C = {
  bg: "#f3ebdd", // Warm Cream
  card: "#faf7f0", // Soft Ivory
  ink: "#252522", // Deep Charcoal
  muted: "#6f675b",
  line: "#e2d7c5",
  gold: "#5f7052", // Sage (darkened for small text)
  dark: "#252522",
};

export function row(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;color:${C.muted};font-size:13px;vertical-align:top;width:42%">${esc(label)}</td>
    <td style="padding:8px 0;color:${C.ink};font-size:14px;vertical-align:top;font-weight:600">${value}</td>
  </tr>`;
}

export function sectionTitle(text: string) {
  return `<p style="margin:28px 0 8px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${C.gold};font-weight:700">${esc(text)}</p>`;
}

export function button(href: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 4px"><tr>
    <td style="background:${C.dark};border-radius:999px">
      <a href="${esc(href)}" style="display:inline-block;padding:14px 28px;color:#faf7f0;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:.02em">${esc(label)}</a>
    </td></tr></table>`;
}

export function layout(opts: { title: string; preheader: string; body: string; footer: string; dir?: "ltr" | "rtl"; lang?: string }) {
  const dir = opts.dir ?? "ltr";
  return `<!doctype html>
<html lang="${opts.lang ?? "fr"}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Helvetica,Arial,sans-serif;color:${C.ink}">
  <span style="display:none!important;opacity:0;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.bg};padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px">
        <tr><td style="background:${C.dark};padding:28px 32px;border-radius:14px 14px 0 0">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:.06em;color:#faf7f0">BOULBOUL <span style="color:#8a9a7b">ART WALL</span></p>
        </td></tr>
        <tr><td style="background:${C.card};padding:32px;border-radius:0 0 14px 14px;text-align:${dir === "rtl" ? "right" : "left"}" dir="${dir}">
          ${opts.body}
        </td></tr>
        <tr><td style="padding:20px 8px;text-align:center;color:${C.muted};font-size:12px;line-height:1.6">${opts.footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export const emailColors = C;

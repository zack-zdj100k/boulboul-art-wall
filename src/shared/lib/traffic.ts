// Where a visitor comes from: campaign links (utm_*), ad click ids, the referrer, or the in-app
// browser of a social network (TikTok / Instagram / Facebook often send no referrer at all).
// Pure functions — shared by the tracking endpoint, the admin page and the tests.

export const TRAFFIC_SOURCES = {
  facebook: { label: "Facebook", color: "#4f7bd9", social: true },
  instagram: { label: "Instagram", color: "#d9568f", social: true },
  tiktok: { label: "TikTok", color: "#3fc9c4", social: true },
  snapchat: { label: "Snapchat", color: "#e8d33f", social: true },
  youtube: { label: "YouTube", color: "#e0503f", social: true },
  whatsapp: { label: "WhatsApp", color: "#4cbf6b", social: true },
  pinterest: { label: "Pinterest", color: "#c23a4a", social: true },
  x: { label: "X (Twitter)", color: "#9aa0a6", social: true },
  linkedin: { label: "LinkedIn", color: "#3c83c4", social: true },
  google: { label: "Google", color: "#d9a441", social: false },
  bing: { label: "Bing", color: "#3aa39a", social: false },
  other: { label: "Autres sites", color: "#8a7f72", social: false },
  direct: { label: "Accès direct", color: "#5d554c", social: false },
} as const;

export type KnownSource = keyof typeof TRAFFIC_SOURCES;

/** Label / colour for any source, including custom utm_source values (e.g. an influencer). */
export function sourceInfo(source: string | null | undefined): { label: string; color: string; social: boolean } {
  if (!source) return { label: "Inconnue", color: "#5d554c", social: false };
  if (source in TRAFFIC_SOURCES) return TRAFFIC_SOURCES[source as KnownSource];
  return { label: source, color: "#b08d57", social: false };
}

const ALIASES: Record<string, KnownSource> = {
  fb: "facebook",
  facebook: "facebook",
  meta: "facebook",
  messenger: "facebook",
  ig: "instagram",
  insta: "instagram",
  instagram: "instagram",
  tiktok: "tiktok",
  tt: "tiktok",
  snap: "snapchat",
  snapchat: "snapchat",
  youtube: "youtube",
  yt: "youtube",
  whatsapp: "whatsapp",
  wa: "whatsapp",
  pinterest: "pinterest",
  x: "x",
  twitter: "x",
  linkedin: "linkedin",
  google: "google",
  bing: "bing",
};

// Referrer host → source (matched on the registrable domain, so l.facebook.com, m.facebook.com… work).
const HOSTS: [RegExp, KnownSource][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(tiktok\.com|tiktokv\.com)$/, "tiktok"],
  [/(^|\.)snapchat\.com$/, "snapchat"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, "pinterest"],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "x"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
];

// In-app browsers announce themselves in the user agent even when they hide the referrer.
const IN_APP: [RegExp, KnownSource][] = [
  [/Instagram/i, "instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/, "facebook"],
  [/musical_ly|BytedanceWebview|TikTok|trill_/i, "tiktok"],
  [/Snapchat/i, "snapchat"],
  [/WhatsApp/i, "whatsapp"],
  [/Pinterest/i, "pinterest"],
];

export const BOT_RE = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp\/\d|embedly|monitor/i;

/** Lower-case slug for free text (utm values): letters, digits, "-" and "_" only. */
export function slugify(value: string | null | undefined, max = 60): string | null {
  if (!value) return null;
  const s = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return s || null;
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export type Traffic = { source: string; medium: string | null; campaign: string | null; referrerHost: string | null; landingPath: string };

export function classifyTraffic({ url, referrer, userAgent, ownHost }: { url: string; referrer?: string | null; userAgent?: string | null; ownHost?: string | null }): Traffic {
  let page: URL;
  try {
    page = new URL(url);
  } catch {
    page = new URL("http://invalid/");
  }
  const q = page.searchParams;
  const refHost = hostOf(referrer);
  const internal = !!refHost && (refHost === (ownHost ?? page.hostname).replace(/^www\./, ""));
  const referrerHost = refHost && !internal ? refHost : null;

  const fromRef = referrerHost ? HOSTS.find(([re]) => re.test(referrerHost))?.[1] : undefined;
  const fromApp = userAgent ? IN_APP.find(([re]) => re.test(userAgent))?.[1] : undefined;
  const utm = slugify(q.get("utm_source"), 40);

  let source: string;
  if (utm) source = ALIASES[utm] ?? utm;
  else if (fromApp) source = fromApp; // most precise for social apps (Instagram also sends fbclid)
  else if (fromRef) source = fromRef;
  else if (q.has("ttclid")) source = "tiktok";
  else if (q.has("fbclid")) source = "facebook";
  else if (q.has("gclid") || q.has("gbraid") || q.has("wbraid")) source = "google";
  else if (q.has("ScCid") || q.has("sccid")) source = "snapchat";
  else if (referrerHost) source = "other";
  else source = "direct";

  const paid = q.has("gclid") || q.has("ttclid") || q.has("gbraid") || q.has("wbraid") || q.has("ScCid");
  const medium = slugify(q.get("utm_medium"), 40) ?? (paid ? "paid" : null);

  return {
    source,
    medium,
    campaign: slugify(q.get("utm_campaign")),
    referrerHost,
    landingPath: (page.pathname || "/").slice(0, 200),
  };
}

export function deviceOf(userAgent: string | null | undefined): "mobile" | "tablet" | "desktop" {
  const ua = userAgent ?? "";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

/** Tracked link to put in a bio, a story or a sponsored post. */
export function campaignLink(base: string, path: string, p: { source: string; medium?: string | null; campaign?: string | null }): string {
  const url = new URL(path || "/", base);
  url.searchParams.set("utm_source", slugify(p.source, 40) ?? "direct");
  const medium = slugify(p.medium, 40);
  if (medium) url.searchParams.set("utm_medium", medium);
  const campaign = slugify(p.campaign);
  if (campaign) url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

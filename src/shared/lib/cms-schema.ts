// CMS section definitions — shared by the admin editor (generic form) and the public pages.
// Localised fields hold { fr, ar }. Empty values are simply not rendered publicly.

export type Localized = { fr?: string; ar?: string };

export type CmsField =
  | { key: string; label: string; type: "text" | "textarea" | "url"; localized?: boolean; help?: string }
  | { key: string; label: string; type: "image"; help?: string }
  | { key: string; label: string; type: "list"; itemLabel: string; fields: CmsField[]; help?: string };

export type CmsSectionDef = { key: string; group: string; title: string; description: string; fields: CmsField[] };

const L = (key: string, label: string, type: "text" | "textarea" = "text", help?: string): CmsField => ({ key, label, type, localized: true, help });

export const CMS_SECTIONS: CmsSectionDef[] = [
  {
    key: "home.hero",
    group: "Accueil",
    title: "Hero (accueil)",
    description: "Titre centré, boutons et éventail de trois images en haut de la page d'accueil.",
    fields: [
      L("title", "Titre — ligne 1"),
      L("titleLine2Prefix", "Titre — ligne 2 (début)"),
      L("titleHighlight", "Titre — ligne 2 (mise en valeur, en vert sauge)"),
      L("description", "Description", "textarea"),
      L("socialProof", "Preuve sociale (facultatif)", "text", "Uniquement un fait réel et vérifiable (ex. un nombre de clients réel). Laissez vide sinon."),
      L("primaryLabel", "Bouton principal — texte"),
      { key: "primaryHref", label: "Bouton principal — lien", type: "url" },
      L("secondaryLabel", "Bouton secondaire — texte"),
      { key: "secondaryHref", label: "Bouton secondaire — lien", type: "url" },
      {
        key: "images",
        label: "Images de l'éventail (3 conseillées)",
        type: "list",
        itemLabel: "Image",
        help: "La deuxième image est au centre, au premier plan.",
        fields: [{ key: "image", label: "Image", type: "image" }, L("alt", "Description de l'image (accessibilité)")],
      },
    ],
  },
  {
    key: "home.intro",
    group: "Accueil",
    title: "Description de la marque",
    description: "Court texte de présentation sous le hero.",
    fields: [L("title", "Titre", "textarea"), L("text", "Texte", "textarea")],
  },
  {
    key: "home.quality",
    group: "Accueil",
    title: "Qualité / matériaux (accueil)",
    description: "Section qualité de l'accueil. Ne renseignez que des informations réelles.",
    fields: [L("eyebrow", "Sur-titre"), L("title", "Titre"), L("text", "Texte", "textarea"), { key: "image", label: "Image", type: "image" }],
  },
  {
    key: "home.cta",
    group: "Accueil",
    title: "Appel à l'action final",
    description: "Dernière section avant le pied de page.",
    fields: [L("title", "Titre"), L("text", "Texte", "textarea"), L("buttonLabel", "Texte du bouton"), { key: "buttonHref", label: "Lien du bouton", type: "url" }, { key: "image", label: "Image", type: "image" }],
  },
  {
    key: "why.page",
    group: "Pourquoi Boulboul",
    title: "Page Pourquoi Boulboul",
    description: "Qualité, cadres, matériaux, impression, emballage… N'affichez que des faits vérifiables.",
    fields: [
      L("title", "Titre"),
      L("intro", "Introduction", "textarea"),
      {
        key: "pillars",
        label: "Points forts",
        type: "list",
        itemLabel: "Point fort",
        help: "Un point sans texte n'est pas affiché publiquement.",
        fields: [L("title", "Titre"), L("text", "Texte", "textarea"), { key: "image", label: "Image", type: "image" }],
      },
      L("materials", "Matériaux utilisés", "textarea"),
      L("production", "Détails de fabrication", "textarea"),
      L("guarantees", "Garanties", "textarea", "Uniquement des garanties réellement offertes."),
      L("pricing", "Positionnement prix", "textarea", "Évitez les superlatifs non vérifiables (ex. « le moins cher d'Algérie »)."),
      {
        key: "certifications",
        label: "Certifications",
        type: "list",
        itemLabel: "Certification",
        help: "À remplir uniquement avec des certifications réelles et vérifiables.",
        fields: [{ key: "name", label: "Nom", type: "text" }, { key: "issuer", label: "Organisme", type: "text" }, { key: "year", label: "Année", type: "text" }, { key: "image", label: "Logo / document", type: "image" }],
      },
    ],
  },
  {
    key: "about.page",
    group: "Qui sommes-nous",
    title: "Page Qui est Boulboul",
    description: "Histoire et fondateurs. Les fondateurs sans nom ne sont pas affichés.",
    fields: [
      L("title", "Titre"),
      L("intro", "Accroche", "textarea"),
      L("story", "Histoire", "textarea"),
      { key: "storyImage", label: "Image de l'histoire", type: "image" },
      {
        key: "founders",
        label: "Fondateurs",
        type: "list",
        itemLabel: "Fondateur",
        fields: [
          { key: "name", label: "Nom", type: "text" },
          L("role", "Rôle"),
          L("bio", "Biographie", "textarea"),
          { key: "photo", label: "Portrait", type: "image" },
          { key: "instagram", label: "Instagram (URL)", type: "url" },
          { key: "tiktok", label: "TikTok (URL)", type: "url" },
          { key: "facebook", label: "Facebook (URL)", type: "url" },
          { key: "linkedin", label: "LinkedIn (URL)", type: "url" },
        ],
      },
    ],
  },
  {
    key: "testimonials",
    group: "Accueil",
    title: "Section avis clients",
    description: "Titres de la section. Les avis viennent de la modération (avis approuvés et « mis en avant »).",
    fields: [L("eyebrow", "Sur-titre"), L("title", "Titre"), L("subtitle", "Sous-titre", "textarea")],
  },
  {
    key: "footer",
    group: "Général",
    title: "Pied de page",
    description: "Slogan et mention de copyright.",
    fields: [L("tagline", "Slogan", "textarea"), L("copyright", "Mention de copyright")],
  },
  {
    key: "contact",
    group: "Général",
    title: "Coordonnées",
    description: "Laissez vide ce que vous ne souhaitez pas afficher.",
    fields: [
      { key: "phone", label: "Téléphone", type: "text" },
      { key: "whatsapp", label: "WhatsApp (numéro international)", type: "text" },
      { key: "email", label: "E-mail", type: "text" },
      L("address", "Adresse / ville", "textarea"),
      { key: "mapsUrl", label: "Lien Google Maps", type: "url" },
      L("hours", "Horaires", "textarea"),
    ],
  },
  {
    key: "social",
    group: "Général",
    title: "Réseaux sociaux",
    description: "Seuls les liens renseignés sont affichés.",
    fields: [
      { key: "instagram", label: "Instagram", type: "url" },
      { key: "tiktok", label: "TikTok", type: "url" },
      { key: "facebook", label: "Facebook", type: "url" },
      { key: "youtube", label: "YouTube", type: "url" },
      { key: "pinterest", label: "Pinterest", type: "url" },
    ],
  },
  {
    key: "legal.terms",
    group: "Mentions légales",
    title: "Conditions générales",
    description: "Texte des conditions générales de vente.",
    fields: [L("body", "Contenu", "textarea")],
  },
  {
    key: "legal.privacy",
    group: "Mentions légales",
    title: "Politique de confidentialité",
    description: "Comment les données clients sont utilisées.",
    fields: [L("body", "Contenu", "textarea")],
  },
  {
    key: "legal.returns",
    group: "Mentions légales",
    title: "Politique de retours & échanges",
    description:
      "Vos conditions de retour et d'échange (délais, état des articles, frais, cas des créations sur mesure…). Rien n'est écrit à votre place : tant que ce texte est vide, la page indique que la politique sera bientôt disponible.",
    fields: [L("body", "Contenu", "textarea")],
  },
];

export const CMS_KEYS = CMS_SECTIONS.map((s) => s.key);

export function getSectionDef(key: string) {
  return CMS_SECTIONS.find((s) => s.key === key);
}

/** Resolve a localised value with French fallback. */
export function loc(value: unknown, locale: string): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const v = value as Localized;
    return (v[locale as keyof Localized] || v.fr || "").trim();
  }
  return "";
}

/** Only allow safe link targets in CMS URL fields. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    const u = new URL(v);
    return ["https:", "http:", "mailto:", "tel:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Image fields store a URL (uploaded media `/media/...` or a bundled asset `/brand/...`). */
export function safeImage(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  if (/^\/(media|brand)\/[\w\-./]+$/.test(v) && !v.includes("..")) return v;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Where each CMS section is shown on the public site (for the admin "Voir sur le site" links).
 * Home sections that are hidden while empty fall back to the top of the page.
 */
export const CMS_PUBLIC_PATHS: Record<string, string> = {
  "home.hero": "/#hero",
  "home.intro": "/#presentation",
  "home.quality": "/#qualite",
  "home.cta": "/#appel",
  testimonials: "/#avis",
  "why.page": "/why-boulboul",
  "about.page": "/about",
  footer: "/#pied-de-page",
  contact: "/#pied-de-page",
  social: "/#pied-de-page",
  "legal.terms": "/legal/terms",
  "legal.privacy": "/legal/privacy",
  "legal.returns": "/legal/returns",
};

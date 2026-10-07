/**
 * DEVELOPMENT SEED — demo data only.
 *
 * Everything created here that is not structural (products, frames, extras, demo customer,
 * demo orders) is flagged `isDemo = true` and shown with a "Démo" badge. Prices — including
 * the demo products' price tables — are placeholders typed for development and are NOT
 * Boulboul's real prices. No price is derived from a formula.
 * Product photos are the real Boulboul photos supplied by the client (public/brand).
 * No reviews, testimonials, founders, contact details or certifications are invented.
 *
 * Run: npm run db:seed
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { priceLine, surMesureFromProduct, type PricingProduct } from "../src/lib/pricing";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const STORAGE_DIR = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./storage/uploads");

const T = (fr: string, ar: string) => ({ fr, ar });

async function importImage(file: string, alt: string) {
  const existing = await prisma.media.findFirst({ where: { originalName: path.basename(file) } });
  if (existing) return existing;
  const buffer = await readFile(path.resolve("public/brand", file));
  const meta = await sharp(buffer).metadata();
  const key = `public/seed/${randomBytes(12).toString("hex")}.jpg`;
  await mkdir(path.dirname(path.join(STORAGE_DIR, key)), { recursive: true });
  await writeFile(path.join(STORAGE_DIR, key), buffer);
  return prisma.media.create({
    data: { key, mime: "image/jpeg", size: buffer.length, width: meta.width, height: meta.height, originalName: path.basename(file), alt, visibility: "PUBLIC" },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");

  // ── Admin (structural — change the password immediately)
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@boulboul.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 10) throw new Error("Set SEED_ADMIN_PASSWORD (10+ chars) in .env");
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash: await hashPassword(adminPassword), fullName: "Administrateur Boulboul", role: "ADMIN" },
  });

  const demoCustomer = await prisma.user.upsert({
    where: { email: "client.demo@boulboul.local" },
    update: {},
    create: {
      email: "client.demo@boulboul.local",
      passwordHash: await hashPassword("Demo-Client-2026"),
      fullName: "Client Démo",
      phone: "0550000000",
      age: 30,
      referralSource: "INSTAGRAM",
      role: "CUSTOMER",
      isDemo: true,
    },
  });

  // ── Categories (from the brief; editable in /admin/categories)
  const categories = [
    { slug: "wall-art", name: "Wall Art", nameAr: "لوحات جدارية", sortOrder: 1 },
    { slug: "canvas", name: "Canvas", nameAr: "كانفاس", sortOrder: 2 },
    { slug: "miroirs", name: "Miroirs", nameAr: "مرايا", sortOrder: 3 },
    { slug: "miroirs-led", name: "Miroirs LED", nameAr: "مرايا LED", sortOrder: 4 },
    { slug: "creations-sur-mesure", name: "Créations sur mesure", nameAr: "تصاميم حسب الطلب", sortOrder: 5 },
    { slug: "pieces-decoratives", name: "Pièces décoratives", nameAr: "قطع ديكور", sortOrder: 6 },
  ];
  const cat: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
    cat[c.slug] = row.id;
  }

  // ── Demo frames & extras (names/prices are placeholders to be replaced by the business)
  async function frame(name: string, nameAr: string, swatch: string, price: number, sortOrder: number) {
    const found = await prisma.frameOption.findFirst({ where: { name, isDemo: true } });
    return found ?? prisma.frameOption.create({ data: { name, nameAr, swatch, price, sortOrder, isDemo: true } });
  }
  const black = await frame("Cadre noir", "إطار أسود", "#151515", 900, 1);
  const wood = await frame("Cadre bois naturel", "إطار خشب طبيعي", "#a87a4f", 1100, 2);
  const gold = await frame("Cadre doré", "إطار ذهبي", "#c9a24f", 1400, 3);

  async function extra(name: string, nameAr: string, price: number, sortOrder: number) {
    const found = await prisma.extraOption.findFirst({ where: { name, isDemo: true } });
    return found ?? prisma.extraOption.create({ data: { name, nameAr, price, sortOrder, isDemo: true } });
  }
  const led = await extra("Rétroéclairage LED", "إضاءة خلفية LED", 3500, 1);
  const mirror = await extra("Miroir", "مرآة", 4000, 2);
  // Demo option details: LED tones to choose from, and a placement question for the mirror.
  await prisma.extraOption.update({
    where: { id: led.id },
    data: { colors: [{ name: "Blanc chaud", hex: "#ffd9a0" }, { name: "Blanc froid", hex: "#eaf4ff" }, { name: "Rouge", hex: "#e2463a" }, { name: "Bleu", hex: "#3a6fe2" }] },
  });
  await prisma.extraOption.update({
    where: { id: mirror.id },
    data: { askNote: true, notePrompt: "Où souhaitez-vous le miroir dans le cadre ?", notePromptAr: "أين تريد المرآة داخل الإطار؟" },
  });
  await extra("Accessoires décoratifs", "إكسسوارات ديكور", 1500, 3);

  // ── Demo products with the real Boulboul photos
  type SeedProduct = {
    slug: string;
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    category: string;
    images: [string, string][];
    /** Demo measures: [width, height, price] — placeholder prices. */
    standard: [number, number, number][];
    /** Demo labelled measures: [width, height, price, label]. */
    special?: [number, number, number, string][];
    /** Demo Sur Mesure: reference measure + stable price, ± step price per 10 cm. */
    custom?: { ref: [number, number]; price: number; step: number };
    frames?: boolean;
    extras?: string[];
    featured?: boolean;
    promo?: { type: "PERCENT" | "FIXED"; value: number };
  };

  const products: SeedProduct[] = [
    {
      slug: "ailes-et-couronne-lumineuses",
      name: "Ailes & couronne lumineuses",
      nameAr: "أجنحة وتاج مضيئة",
      description: "Composition murale rétroéclairée : deux ailes sculptées et une couronne dorée, mises en valeur par un halo lumineux chaud.",
      descriptionAr: "تركيبة جدارية بإضاءة خلفية: جناحان منحوتان وتاج ذهبي تبرزهما هالة ضوء دافئة.",
      category: "pieces-decoratives",
      images: [["products/crown-wings-staged.jpg", "Ailes et couronne lumineuses au-dessus d'un lit"], ["products/crown-wings-real.jpg", "Ailes et couronne installées dans un intérieur"]],
      standard: [[80, 100, 15000], [100, 120, 18000], [120, 150, 24000]],
      featured: true,
    },
    {
      slug: "miroir-la-casa-de-papel",
      name: "Miroir néon La Casa de Papel",
      nameAr: "مرآة نيون La Casa de Papel",
      description: "Miroir ovale encadré d'un néon rouge, découpé dans une silhouette illustrée. Une pièce forte pour une entrée ou une chambre.",
      descriptionAr: "مرآة بيضاوية محاطة بنيون أحمر داخل شكل مرسوم. قطعة مميزة للمدخل أو غرفة النوم.",
      category: "miroirs-led",
      images: [["products/casa-papel-staged.jpg", "Miroir néon La Casa de Papel dans une entrée"], ["products/casa-papel-workshop.jpg", "Miroir La Casa de Papel à l'atelier"]],
      standard: [[90, 150, 26000], [110, 180, 32000]],
      featured: true,
    },
    {
      slug: "miroirs-arches-jumeaux-led",
      name: "Miroirs arches jumeaux LED",
      nameAr: "مرآتان مقوستان LED",
      description: "Paire de miroirs aux bords arrondis avec rétroéclairage LED diffus. Format ajustable à votre mur.",
      descriptionAr: "زوج من المرايا بحواف دائرية مع إضاءة LED خلفية ناعمة. مقاس قابل للتعديل حسب جدارك.",
      category: "miroirs-led",
      images: [["products/twin-mirrors-staged.jpg", "Deux miroirs LED arrondis sur un mur sombre"], ["products/twin-mirrors-real.jpg", "Miroirs LED installés dans un salon de beauté"], ["products/arch-mirror-salon.jpg", "Miroir LED en arche dans un salon"]],
      standard: [[40, 100, 14000], [50, 120, 17000], [60, 150, 22000], [80, 180, 28000]],
      special: [[65, 155, 23500, "Format salle de bain"]],
      custom: { ref: [60, 150], price: 22000, step: 200 },
      featured: true,
    },
    {
      slug: "miroir-arche-led",
      name: "Miroir arche LED",
      nameAr: "مرآة مقوسة LED",
      description: "Miroir pleine hauteur en forme d'arche, avec contour lumineux. Idéal pour une entrée ou une chambre.",
      descriptionAr: "مرآة بطول كامل على شكل قوس مع إطار مضيء. مثالية للمدخل أو غرفة النوم.",
      category: "miroirs-led",
      images: [["products/arch-mirror-real.jpg", "Miroir arche LED à côté d'une plante"]],
      standard: [[50, 140, 13500], [60, 160, 16000]],
    },
    {
      slug: "miroir-organique-led",
      name: "Miroir organique LED",
      nameAr: "مرآة عضوية LED",
      description: "Miroir aux courbes libres, rétroéclairé. Une forme douce qui casse les lignes droites d'une pièce.",
      descriptionAr: "مرآة بانحناءات حرة مع إضاءة خلفية. شكل ناعم يكسر الخطوط المستقيمة في الغرفة.",
      category: "miroirs-led",
      images: [["products/organic-mirror-pink.jpg", "Miroir organique rétroéclairé en rose"], ["products/organic-mirror-shelves.jpg", "Miroir organique entre deux étagères"]],
      standard: [[60, 150, 15000]],
    },
    {
      slug: "canvas-life-goes-on",
      name: "Canvas « Life goes on »",
      nameAr: "كانفاس « Life goes on »",
      description: "Pétale violet perlé de gouttes et typographie affirmée, imprimé sur toile tendue.",
      descriptionAr: "بتلة بنفسجية بقطرات ماء وخط عريض، مطبوعة على قماش مشدود.",
      category: "canvas",
      images: [["products/life-goes-on-staged.jpg", "Canvas Life goes on dans un salon"]],
      standard: [[40, 30, 4500], [60, 40, 6500], [90, 60, 9500], [120, 80, 13500]],
      special: [[65, 90, 8200, "Medium Custom"]],
      custom: { ref: [60, 40], price: 6500, step: 200 },
      frames: true,
      extras: ["led"],
      featured: true,
    },
    {
      slug: "canvas-collect-moments",
      name: "Canvas « Collect moments, not things »",
      nameAr: "كانفاس « Collect moments, not things »",
      description: "Illustration d'appareil photo et citation, tons lavande. Pour un coin lecture ou une chambre.",
      descriptionAr: "رسم لكاميرا مع عبارة بألوان الخزامى. لركن القراءة أو غرفة النوم.",
      category: "canvas",
      images: [["products/collect-moments-staged.jpg", "Canvas Collect moments sur un mur"], ["products/collect-moments-workshop.jpg", "Canvas Collect moments à l'atelier"]],
      standard: [[40, 60, 6000], [60, 90, 8500]],
      frames: true,
    },
    {
      slug: "tableau-one-piece-luffy",
      name: "Tableau One Piece — Luffy",
      nameAr: "لوحة One Piece — لوفي",
      description: "Le sourire de Luffy sur fond de ciel bleu, imprimé sur toile. Pour les fans d'anime.",
      descriptionAr: "ابتسامة لوفي على خلفية سماء زرقاء، مطبوعة على قماش. لعشاق الأنمي.",
      category: "wall-art",
      images: [["products/luffy-staged.jpg", "Tableau Luffy éclairé sur un mur sombre"], ["products/luffy-workshop.jpg", "Tableau Luffy à l'atelier"]],
      standard: [[40, 60, 5000], [50, 70, 6200], [70, 100, 8800]],
      frames: true,
      promo: { type: "PERCENT", value: 10 },
      featured: true,
    },
    {
      slug: "tableau-boxe-knockdown",
      name: "Tableau Boxe — Knockdown",
      nameAr: "لوحة ملاكمة — Knockdown",
      description: "Illustration en noir et blanc d'un boxeur dans le ring, sous un projecteur.",
      descriptionAr: "رسم بالأبيض والأسود لملاكم في الحلبة تحت ضوء كاشف.",
      category: "wall-art",
      images: [["products/boxing-knockdown.jpg", "Tableau boxe noir et blanc"]],
      standard: [[40, 70, 5500], [60, 100, 7900]],
      frames: true,
    },
    {
      slug: "tableau-boxe-silhouette",
      name: "Tableau Boxe — Silhouette",
      nameAr: "لوحة ملاكمة — Silhouette",
      description: "Silhouette de boxeur en contre-jour, contraste noir profond.",
      descriptionAr: "صورة ظلية لملاكم بإضاءة خلفية وتباين أسود عميق.",
      category: "wall-art",
      images: [["products/boxing-silhouette.jpg", "Silhouette de boxeur"]],
      standard: [[40, 80, 5500]],
      frames: true,
    },
    {
      slug: "tableau-boxe-bandages",
      name: "Tableau Boxe — Bandages",
      nameAr: "لوحة ملاكمة — الضمادات",
      description: "Gros plan sur des mains bandées avant le combat.",
      descriptionAr: "لقطة قريبة لأيدٍ ملفوفة قبل النزال.",
      category: "wall-art",
      images: [["products/boxing-wraps.jpg", "Mains bandées de boxeur"]],
      standard: [[40, 70, 5500]],
      frames: true,
    },
  ];

  for (const [i, p] of products.entries()) {
    if (await prisma.product.findUnique({ where: { slug: p.slug } })) continue;
    const media = [];
    for (const [file, alt] of p.images) media.push(await importImage(file, alt));
    await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        nameAr: p.nameAr,
        description: p.description,
        descriptionAr: p.descriptionAr,
        categoryId: cat[p.category],
        status: "ACTIVE",
        isFeatured: !!p.featured,
        isDemo: true,
        allowCustomSize: !!p.custom,
        refWidthCm: p.custom?.ref[0] ?? null,
        refHeightCm: p.custom?.ref[1] ?? null,
        refPrice: p.custom?.price ?? null,
        widthStepPrice: p.custom?.step ?? null,
        heightStepPrice: p.custom?.step ?? null,
        promoType: p.promo?.type ?? null,
        promoValue: p.promo?.value ?? null,
        sortOrder: i,
        images: { create: media.map((m, idx) => ({ mediaId: m.id, alt: m.alt, sortOrder: idx })) },
        frames: p.frames ? { create: [{ frameId: black.id, isDefault: true }, { frameId: wood.id }, { frameId: gold.id }] } : undefined,
        extras: p.extras ? { create: p.extras.map((e) => ({ extraId: e === "led" ? led.id : mirror.id })) } : undefined,
      },
    });
  }

  // Demo price tables, only for demo products that have none yet (never overwrites admin edits).
  for (const p of products) {
    const row = await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true, isDemo: true, _count: { select: { measures: true } } } });
    if (!row?.isDemo || row._count.measures > 0) continue;
    await prisma.productMeasure.createMany({
      data: [
        ...p.standard.map(([widthCm, heightCm, price]) => ({ productId: row.id, widthCm, heightCm, price })),
        ...(p.special ?? []).map(([widthCm, heightCm, price, label]) => ({ productId: row.id, widthCm, heightCm, price, label })),
      ],
    });
  }

  // Demo Sur Mesure (placeholder, dev only): stable price = the smallest demo measure, ± 200 DA per
  // 10 cm of length / height — only for demo products where nothing is configured yet.
  const demoNoSurMesure = await prisma.product.findMany({
    where: { isDemo: true, refPrice: null },
    select: { id: true, measures: { where: { isActive: true }, orderBy: { price: "asc" }, take: 1 } },
  });
  for (const p of demoNoSurMesure) {
    const m = p.measures[0];
    if (!m) continue;
    await prisma.product.update({
      where: { id: p.id },
      data: { allowCustomSize: true, refWidthCm: m.widthCm, refHeightCm: m.heightCm, refPrice: m.price, widthStepPrice: 200, heightStepPrice: 200 },
    });
  }

  // ── CMS defaults — copy taken from the brief; everything else left empty for the business.
  const brand = (f: string) => `/brand/${f}`;
  const cms: Record<string, Prisma.InputJsonValue> = {
    "home.hero": {
      title: T("De beaux murs,", "جدران جميلة،"),
      titleLine2Prefix: T("faits pour", "مصممة"),
      titleHighlight: T("votre espace.", "لمساحتك."),
      description: T(
        "Wall art, canvas, miroirs LED et créations sur mesure — une décoration de qualité pour votre maison, votre bureau ou votre boutique.",
        "لوحات جدارية، كانفاس، مرايا LED وتصاميم حسب الطلب — ديكور عالي الجودة لبيتك أو مكتبك أو متجرك.",
      ),
      socialProof: T("", ""),
      primaryLabel: T("Découvrir nos créations", "اكتشف إبداعاتنا"),
      primaryHref: "/wall-art",
      secondaryLabel: T("Créer mon design", "أنشئ تصميمي"),
      secondaryHref: "/customize",
      images: [
        { image: brand("products/life-goes-on-staged.jpg"), alt: T("Canvas « Life goes on » dans un salon", "كانفاس Life goes on في غرفة الجلوس") },
        { image: brand("products/crown-wings-staged.jpg"), alt: T("Ailes et couronne lumineuses au-dessus d'un lit", "أجنحة وتاج مضيئة فوق سرير") },
        { image: brand("products/twin-mirrors-staged.jpg"), alt: T("Deux miroirs LED arrondis", "مرآتان LED مقوستان") },
      ],
    },
    "home.intro": {
      title: T("Une décoration murale pensée pour votre espace.", "ديكور جداري مصمم لمساحتك."),
      text: T("Boulboul Art Wall réalise des pièces décoratives pour les maisons, les bureaux et les commerces : wall art, canvas, miroirs, miroirs LED et créations personnalisées selon vos idées.", "يصنع Boulboul Art Wall قطعاً ديكورية للبيوت والمكاتب والمحلات: لوحات جدارية، كانفاس، مرايا، مرايا LED وتصاميم مخصصة حسب أفكارك."),
    },
    "home.quality": { eyebrow: T("Qualité", "الجودة"), title: T("Qualité & matériaux", "الجودة والمواد"), text: T("", ""), image: "" },
    "home.cta": {
      title: T("Prêt à transformer votre mur ?", "مستعد لتغيير جدارك؟"),
      text: T("Choisissez une création ou envoyez-nous votre idée.", "اختر تصميماً أو أرسل لنا فكرتك."),
      buttonLabel: T("Explorer la collection", "استكشف المجموعة"),
      buttonHref: "/wall-art",
      image: brand("scenes/wall-sunlit.jpg"),
    },
    "why.page": {
      title: T("Pourquoi Boulboul", "لماذا Boulboul"),
      intro: T("Ce qui compte pour nous, de l'atelier à votre mur.", "ما يهمنا، من الورشة إلى جدارك."),
      pillars: [
        { title: T("Qualité des produits", "جودة المنتجات"), text: T("", ""), image: "" },
        { title: T("Construction des cadres", "صناعة الإطارات"), text: T("", ""), image: "" },
        { title: T("Qualité d'impression", "جودة الطباعة"), text: T("", ""), image: "" },
        { title: T("Design", "التصميم"), text: T("", ""), image: "" },
        { title: T("Emballage", "التغليف"), text: T("", ""), image: "" },
        { title: T("Préparation de la livraison", "تحضير التوصيل"), text: T("", ""), image: "" },
        {
          title: T("Personnalisation", "التخصيص"),
          text: T("Dimensions, cadre et options : de nombreuses créations s'adaptent à votre mur, et vous pouvez nous envoyer votre propre design.", "المقاسات والإطار والإضافات: العديد من التصاميم تتكيف مع جدارك، ويمكنك إرسال تصميمك الخاص."),
          image: brand("products/crown-wings-real.jpg"),
        },
        {
          title: T("Expérience client", "تجربة الزبون"),
          text: T("Commande simple en ligne : Boulboul vérifie et confirme chaque commande avant de la préparer, et vous suivez son statut depuis votre compte.", "طلب بسيط عبر الإنترنت: يتحقق Boulboul من كل طلب ويؤكده قبل تحضيره، وتتابع حالته من حسابك."),
          image: "",
        },
      ],
      materials: T("", ""),
      production: T("", ""),
      guarantees: T("", ""),
      pricing: T("", ""),
      certifications: [],
    },
    "about.page": {
      title: T("Qui est Boulboul", "من هو Boulboul"),
      intro: T("", ""),
      story: T("", ""),
      storyImage: brand("scenes/showroom-collection.jpg"),
      founders: [
        { name: "", role: T("", ""), bio: T("", ""), photo: "", instagram: "", tiktok: "", facebook: "", linkedin: "" },
        { name: "", role: T("", ""), bio: T("", ""), photo: "", instagram: "", tiktok: "", facebook: "", linkedin: "" },
      ],
    },
    testimonials: { eyebrow: T("Avis clients", "آراء الزبائن"), title: T("Ils ont habillé leurs murs", "جدران غيّروها معنا"), subtitle: T("", "") },
    footer: {
      tagline: T("Transformez vos murs.\nExprimez votre style.", "غيّر جدرانك.\nعبّر عن أسلوبك."),
      copyright: T("Boulboul Art Wall", "Boulboul Art Wall"),
    },
    contact: { phone: "", whatsapp: "", email: "", address: T("", ""), mapsUrl: "", hours: T("", "") },
    social: { instagram: "", tiktok: "", facebook: "", youtube: "", pinterest: "" },
    "legal.terms": { body: T("", "") },
    "legal.privacy": { body: T("", "") },
    "legal.returns": { body: T("", "") }, // the business writes its own policy — nothing invented
  };
  for (const [key, content] of Object.entries(cms)) {
    await prisma.cmsSection.upsert({ where: { key }, update: {}, create: { key, draft: content, published: content, publishedAt: new Date() } });
  }

  // ── Demo orders (flagged isDemo) so the admin dashboard has something to show
  if ((await prisma.order.count({ where: { isDemo: true } })) === 0) {
    const include = { measures: true, frames: { include: { frame: true } }, extras: { include: { extra: true } }, images: { include: { media: true }, take: 1 } } as const;
    const luffy = await prisma.product.findUniqueOrThrow({ where: { slug: "tableau-one-piece-luffy" }, include });
    const lifeGoesOn = await prisma.product.findUniqueOrThrow({ where: { slug: "canvas-life-goes-on" }, include });
    const toPricing = (p: typeof luffy): PricingProduct => ({
      ...p,
      surMesure: surMesureFromProduct(p),
      frames: p.frames.map((f) => ({ id: f.frame.id, name: f.frame.name, price: f.priceOverride ?? f.frame.price, isActive: f.frame.isActive })),
      extras: p.extras.map((e) => ({ id: e.extra.id, name: e.extra.name, price: e.priceOverride ?? e.extra.price, isActive: e.extra.isActive })),
    });
    const demos = [
      { product: luffy, cfg: { widthCm: 50, heightCm: 70, frameId: black.id }, status: "PENDING" as const },
      { product: lifeGoesOn, cfg: { widthCm: 90, heightCm: 60, frameId: wood.id, extraIds: [led.id] }, status: "CONFIRMED" as const },
    ];
    for (const d of demos) {
      const b = priceLine(toPricing(d.product), d.cfg);
      const extras = b.extras.map((e) => (e.id === led.id ? { ...e, color: "Blanc chaud" } : e));
      await prisma.$transaction(async (tx) => {
        const [{ value }] = await tx.$queryRaw<{ value: number }[]>`
          INSERT INTO "Counter" ("key","value") VALUES (${"order:" + new Date().getFullYear()}, 1)
          ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1 RETURNING "value"`;
        await tx.order.create({
          data: {
            orderNumber: `BAW-${new Date().getFullYear()}-${String(value).padStart(6, "0")}`,
            publicToken: randomBytes(24).toString("base64url"),
            userId: demoCustomer.id,
            customerName: "Client Démo",
            email: "client.demo@boulboul.local",
            phone: "0550000000",
            wilayaCode: "16",
            wilayaName: "Alger",
            commune: "Commune démo",
            address: "Adresse de démonstration",
            notes: "Commande de démonstration (seed)",
            subtotal: b.total,
            deliveryFee: null,
            total: b.total,
            status: d.status,
            isDemo: true,
            confirmedAt: d.status === "CONFIRMED" ? new Date() : null,
            items: {
              create: {
                productId: d.product.id,
                productName: d.product.name,
                productSlug: d.product.slug,
                productImageUrl: d.product.images[0] ? `/media/${d.product.images[0].media.key}` : null,
                widthCm: b.widthCm,
                heightCm: b.heightCm,
                pricingType: b.pricingType,
                pricingRefId: b.pricingRefId,
                pricingLabel: b.pricingLabel,
                officialPrice: b.officialPrice,
                promotionType: b.promotion?.type ?? null,
                promotionValue: b.promotion?.value ?? null,
                promotionDiscount: b.promotionDiscount,
                priceAfterPromotion: b.priceAfterPromotion,
                optionsPrice: b.optionsPrice,
                frameId: b.frame?.id,
                frameName: b.frame?.name,
                extras,
                quantity: b.quantity,
                unitPrice: b.unitPrice,
                totalPrice: b.total,
                pricingBreakdown: { ...b, extras } as unknown as Prisma.InputJsonValue,
              },
            },
            history: {
              create: [
                { fromStatus: null, toStatus: "PENDING", note: "Démo" },
                ...(d.status === "CONFIRMED" ? [{ fromStatus: "PENDING" as const, toStatus: "CONFIRMED" as const, note: "Démo" }] : []),
              ],
            },
          },
        });
      });
    }
  }

  console.log("✔ Seed complete (demo data flagged isDemo).");
  console.log(`  Admin: ${adminEmail}  (password from SEED_ADMIN_PASSWORD — change it)`);
  console.log("  Demo customer: client.demo@boulboul.local / Demo-Client-2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

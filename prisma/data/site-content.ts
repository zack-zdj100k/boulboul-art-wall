// Editorial content published on the live site by `npm run publish-content`.
//
// Only what can be seen or is true on the site itself: product descriptions written from the real
// photos, how ordering / delivery / returns work on this site. Nothing invented — no founders, no
// years, no materials, no guarantees, no contact details (those are filled by Boulboul in the admin).

type L = { fr: string; ar: string };

export const CATEGORY_CONTENT: Record<string, { description: L; sortOrder: number; coverProduct?: string }> = {
  "miroirs-led": {
    sortOrder: 1,
    coverProduct: "miroirs-arches-jumeaux-led",
    description: {
      fr: "Des miroirs qui éclairent autant qu'ils reflètent : arches, formes organiques et néons, avec un halo LED doux pour l'entrée, la chambre ou la salle de bain.",
      ar: "مرايا تُضيء بقدر ما تعكس: أقواس وأشكال عضوية ونيون، مع هالة LED ناعمة للمدخل أو غرفة النوم أو الحمام.",
    },
  },
  "wall-art": {
    sortOrder: 2,
    coverProduct: "tableau-one-piece-luffy",
    description: {
      fr: "Tableaux à forte personnalité — boxe, anime, univers pop — pour donner du caractère à une chambre, un salon ou une salle de sport.",
      ar: "لوحات بشخصية قوية — ملاكمة، أنمي، عوالم البوب — تمنح الطابع لغرفة النوم أو الصالون أو قاعة الرياضة.",
    },
  },
  canvas: {
    sortOrder: 3,
    coverProduct: "canvas-life-goes-on",
    description: {
      fr: "Citations et illustrations imprimées sur toile tendue : des pièces douces et lumineuses pour un coin lecture, une chambre ou un bureau.",
      ar: "عبارات ورسومات مطبوعة على قماش مشدود: قطع ناعمة ومشرقة لركن القراءة أو غرفة النوم أو المكتب.",
    },
  },
  "pieces-decoratives": {
    sortOrder: 4,
    coverProduct: "ailes-et-couronne-lumineuses",
    description: {
      fr: "Compositions murales en volume et rétroéclairées : la pièce qui attire tous les regards au-dessus d'un lit ou d'un canapé.",
      ar: "تركيبات جدارية مجسّمة بإضاءة خلفية: القطعة التي تجذب الأنظار فوق السرير أو الأريكة.",
    },
  },
  miroirs: {
    sortOrder: 5,
    description: {
      fr: "Miroirs décoratifs aux formes sur mesure, pensés pour agrandir et habiller vos murs.",
      ar: "مرايا ديكور بأشكال حسب الطلب، لتوسيع جدرانك وتزيينها.",
    },
  },
  "creations-sur-mesure": {
    sortOrder: 6,
    description: {
      fr: "Votre image, votre idée, vos dimensions : envoyez-nous votre projet depuis la page « Sur mesure », nous l'étudions et revenons vers vous.",
      ar: "صورتك، فكرتك، مقاساتك: أرسل لنا مشروعك من صفحة «حسب الطلب»، ندرسه ونعود إليك.",
    },
  },
};

type ProductContent = {
  name?: L;
  description: L;
  characteristics: string[];
  seoDescription: string;
  isFeatured?: boolean;
  /** Extra photo from public/brand to add to the gallery (uploaded to Cloudinary). */
  addImage?: { file: string; alt: string };
};

export const PRODUCT_CONTENT: Record<string, ProductContent> = {
  "miroirs-arches-jumeaux-led": {
    isFeatured: true,
    description: {
      fr: "Deux miroirs aux bords arrondis, posés côte à côte et soulignés d'un rétroéclairage LED diffus. Le duo crée une symétrie apaisante au-dessus d'une console, d'un lavabo double ou de part et d'autre d'un lit, et la lumière douce réchauffe la pièce le soir. Dimensions adaptables à votre mur.",
      ar: "مرآتان بحواف دائرية جنباً إلى جنب، تحيط بهما إضاءة LED خلفية ناعمة. يخلق هذا الثنائي تناظراً مريحاً فوق طاولة جانبية أو حوض مزدوج أو على جانبي السرير، ويمنح الضوء الهادئ دفئاً للغرفة في المساء. المقاسات قابلة للتكييف حسب جدارك.",
    },
    characteristics: ["Rétroéclairage LED", "Lot de 2 miroirs", "Bords arrondis", "Dimensions adaptables"],
    seoDescription: "Paire de miroirs arches avec rétroéclairage LED, dimensions adaptables. Boulboul Art Wall, livraison partout en Algérie.",
  },
  "miroir-arche-led": {
    description: {
      fr: "Un grand miroir en arche, pleine hauteur, entouré d'un contour lumineux. Parfait pour vérifier sa tenue dans l'entrée, agrandir visuellement une chambre ou apporter une touche boutique à un dressing.",
      ar: "مرآة كبيرة على شكل قوس بطول كامل، يحيط بها إطار مضيء. مثالية لإلقاء نظرة على إطلالتك في المدخل، أو لتوسيع غرفة النوم بصرياً، أو لإضافة لمسة بوتيك إلى غرفة الملابس.",
    },
    characteristics: ["Contour lumineux LED", "Forme arche", "Pleine hauteur"],
    seoDescription: "Miroir arche pleine hauteur avec contour LED pour entrée, chambre ou dressing. Boulboul Art Wall.",
  },
  "miroir-organique-led": {
    description: {
      fr: "Des courbes libres et un rétroéclairage qui dessine un halo tout autour : ce miroir organique casse les lignes droites d'une pièce et devient une pièce déco à part entière, allumé comme éteint.",
      ar: "انحناءات حرة وإضاءة خلفية ترسم هالة حولها: هذه المرآة العضوية تكسر الخطوط المستقيمة في الغرفة وتصبح قطعة ديكور قائمة بذاتها، مضاءة أو مطفأة.",
    },
    characteristics: ["Rétroéclairage LED", "Forme organique"],
    seoDescription: "Miroir à forme organique rétroéclairé LED, une pièce déco douce et moderne. Boulboul Art Wall.",
  },
  "miroir-la-casa-de-papel": {
    isFeatured: true,
    description: {
      fr: "Pour les fans de la série : un miroir ovale encadré d'un néon rouge, découpé dans une silhouette illustrée au masque emblématique. Une pièce forte qui transforme une chambre, une salle de jeux ou l'entrée d'un commerce.",
      ar: "لعشّاق المسلسل: مرآة بيضاوية يحيط بها نيون أحمر داخل شكل مرسوم بالقناع الشهير. قطعة قوية تُغيّر غرفة النوم أو غرفة الألعاب أو مدخل المحل.",
    },
    characteristics: ["Néon rouge", "Miroir ovale", "Silhouette illustrée"],
    seoDescription: "Miroir néon rouge La Casa de Papel, pièce déco pour chambre, salle de jeux ou commerce. Boulboul Art Wall.",
  },
  "ailes-et-couronne-lumineuses": {
    isFeatured: true,
    description: {
      fr: "Deux ailes sculptées et une couronne dorée, rétroéclairées d'un halo chaud. Installée au-dessus d'un lit ou d'un canapé, cette composition en volume donne un vrai effet « waouh » et une ambiance feutrée dès la tombée de la nuit.",
      ar: "جناحان منحوتان وتاج ذهبي بإضاءة خلفية دافئة. فوق السرير أو الأريكة، تمنح هذه التركيبة المجسّمة تأثيراً مبهراً وأجواء هادئة مع حلول الليل.",
    },
    characteristics: ["Rétroéclairage chaud", "Composition 3 éléments (2 ailes + couronne)", "Effet volume"],
    seoDescription: "Composition murale ailes et couronne lumineuses rétroéclairées, au-dessus d'un lit ou d'un canapé. Boulboul Art Wall.",
  },
  "tableau-one-piece-luffy": {
    isFeatured: true,
    description: {
      fr: "Le sourire de Luffy, chapeau de paille vissé sur la tête, sur un grand ciel bleu. Un tableau plein d'énergie pour les fans de One Piece : chambre, salle de jeux ou coin gaming.",
      ar: "ابتسامة لوفي بقبعة القش على خلفية سماء زرقاء واسعة. لوحة مليئة بالطاقة لعشّاق One Piece: غرفة النوم أو غرفة الألعاب أو ركن الألعاب الإلكترونية.",
    },
    characteristics: ["Impression sur toile", "Univers anime"],
    seoDescription: "Tableau One Piece Luffy imprimé sur toile pour chambre ou coin gaming. Boulboul Art Wall, livraison dans toute l'Algérie.",
  },
  "tableau-boxe-knockdown": {
    description: {
      fr: "Un boxeur au tapis, saisi en noir et blanc sous la lumière crue du projecteur. L'intensité du ring sur votre mur : idéal pour une salle de sport, un club ou une chambre.",
      ar: "ملاكم على أرض الحلبة، بالأبيض والأسود تحت ضوء الكاشف الحاد. حماس الحلبة على جدارك: مثالية لقاعة رياضة أو نادٍ أو غرفة نوم.",
    },
    characteristics: ["Noir & blanc", "Univers boxe"],
    seoDescription: "Tableau boxe Knockdown en noir et blanc pour salle de sport ou chambre. Boulboul Art Wall.",
  },
  "tableau-boxe-silhouette": {
    description: {
      fr: "La silhouette d'un boxeur en contre-jour, dans un contraste noir profond. Une image graphique et minimaliste qui inspire la discipline — parfaite pour une salle de sport ou un bureau.",
      ar: "صورة ظلية لملاكم بإضاءة خلفية وتباين أسود عميق. صورة بسيطة وقوية تُلهم الانضباط — مثالية لقاعة رياضة أو مكتب.",
    },
    characteristics: ["Contraste noir profond", "Univers boxe", "Style minimaliste"],
    seoDescription: "Tableau silhouette de boxeur en contre-jour, style minimaliste. Boulboul Art Wall.",
  },
  "tableau-boxe-bandages": {
    description: {
      fr: "Gros plan sur des mains bandées, juste avant le combat. Un tableau qui raconte la préparation et la détermination, pour une salle de boxe, un coin fitness ou une chambre.",
      ar: "لقطة قريبة لأيدٍ ملفوفة بالضمادات قبيل النزال. لوحة تحكي الاستعداد والعزيمة، لقاعة ملاكمة أو ركن لياقة أو غرفة نوم.",
    },
    characteristics: ["Univers boxe", "Gros plan"],
    seoDescription: "Tableau boxe mains bandées pour salle de sport ou chambre. Boulboul Art Wall.",
    addImage: { file: "public/brand/products/boxing-wraps.jpg", alt: "Tableau Boxe — Bandages" },
  },
  "canvas-life-goes-on": {
    description: {
      fr: "Un pétale violet perlé de gouttes d'eau et une typographie affirmée : « Life goes on ». Imprimé sur toile tendue, ce canvas apporte couleur et optimisme à un salon, une chambre ou un bureau.",
      ar: "بتلة بنفسجية تزيّنها قطرات الماء وخط عريض: «Life goes on». مطبوعة على قماش مشدود، تضيف هذه اللوحة لوناً وتفاؤلاً للصالون أو غرفة النوم أو المكتب.",
    },
    characteristics: ["Toile tendue", "Citation", "Tons violets"],
    seoDescription: "Canvas Life goes on, pétale violet et citation imprimés sur toile tendue. Boulboul Art Wall.",
  },
  "canvas-collect-moments": {
    description: {
      fr: "Un appareil photo illustré et une phrase à garder en tête : « Collect moments, not things ». Dans des tons lavande tout doux, ce canvas trouve sa place dans un coin lecture, une chambre ou au-dessus d'un bureau.",
      ar: "كاميرا مرسومة وعبارة تستحق التذكّر: «Collect moments, not things». بألوان الخزامى الهادئة، تجد هذه اللوحة مكانها في ركن القراءة أو غرفة النوم أو فوق المكتب.",
    },
    characteristics: ["Toile tendue", "Citation", "Tons lavande"],
    seoDescription: "Canvas Collect moments, not things aux tons lavande pour chambre ou coin lecture. Boulboul Art Wall.",
  },
};

const img = (path: string) => path; // CMS image fields accept bundled assets (/brand/...)

export const CMS_CONTENT: Record<string, Record<string, unknown>> = {
  "home.hero": {
    title: { fr: "De beaux murs,", ar: "جدران جميلة،" },
    titleLine2Prefix: { fr: "faits pour", ar: "مصممة" },
    titleHighlight: { fr: "votre espace.", ar: "لمساحتك." },
    description: {
      fr: "Miroirs LED, tableaux, canvas et créations sur mesure, fabriqués à la commande et livrés partout en Algérie.",
      ar: "مرايا LED، لوحات، كانفاس وتصاميم حسب الطلب، تُصنع عند الطلب وتُوصَل إلى كل أنحاء الجزائر.",
    },
    socialProof: { fr: "", ar: "" },
    primaryLabel: { fr: "Découvrir nos créations", ar: "اكتشف إبداعاتنا" },
    primaryHref: "/wall-art",
    secondaryLabel: { fr: "Créer mon design", ar: "أنشئ تصميمي" },
    secondaryHref: "/customize",
    images: [
      { image: img("/brand/products/life-goes-on-staged.jpg"), alt: { fr: "Canvas « Life goes on » dans un salon", ar: "كانفاس Life goes on في غرفة الجلوس" } },
      { image: img("/brand/products/crown-wings-staged.jpg"), alt: { fr: "Ailes et couronne lumineuses au-dessus d'un lit", ar: "أجنحة وتاج مضيئة فوق سرير" } },
      { image: img("/brand/products/twin-mirrors-staged.jpg"), alt: { fr: "Deux miroirs LED en arche", ar: "مرآتان LED مقوستان" } },
      { image: img("/brand/products/luffy-staged.jpg"), alt: { fr: "Tableau One Piece — Luffy", ar: "لوحة One Piece — لوفي" } },
    ],
  },
  "home.intro": {
    title: { fr: "Une décoration murale pensée pour votre espace.", ar: "ديكور جداري مصمم لمساحتك." },
    text: {
      fr: "Boulboul Art Wall imagine et fabrique des pièces murales pour les maisons, les bureaux et les commerces : miroirs LED, tableaux, canvas et créations personnalisées. Choisissez une création, ajustez ses dimensions, ou envoyez-nous votre propre idée.",
      ar: "يصمّم Boulboul Art Wall ويصنع قطعاً جدارية للبيوت والمكاتب والمحلات: مرايا LED، لوحات، كانفاس وتصاميم مخصّصة. اختر تصميماً، عدّل مقاساته، أو أرسل لنا فكرتك الخاصة.",
    },
  },
  "home.quality": {
    eyebrow: { fr: "L'atelier", ar: "الورشة" },
    title: { fr: "Fabriqué à la commande, à vos mesures", ar: "يُصنع عند الطلب، على مقاسك" },
    text: {
      fr: "Chaque pièce est réalisée pour vous après confirmation de votre commande : vous choisissez les dimensions, le cadre et les options, et nous vous rappelons pour valider chaque détail avant de lancer la fabrication.",
      ar: "كل قطعة تُنجز لك بعد تأكيد طلبك: تختار المقاسات والإطار والإضافات، ونتصل بك للتحقق من كل التفاصيل قبل بدء التصنيع.",
    },
    image: img("/brand/products/casa-papel-workshop.jpg"),
  },
  "home.cta": {
    title: { fr: "Prêt à transformer votre mur ?", ar: "مستعد لتغيير جدارك؟" },
    text: {
      fr: "Choisissez une création de la collection ou envoyez-nous votre idée : nous la rendons réelle, à vos dimensions.",
      ar: "اختر قطعة من المجموعة أو أرسل لنا فكرتك: نحوّلها إلى حقيقة، على مقاساتك.",
    },
    buttonLabel: { fr: "Explorer la collection", ar: "استكشف المجموعة" },
    buttonHref: "/wall-art",
    image: img("/brand/scenes/wall-sunlit.jpg"),
  },
  testimonials: {
    eyebrow: { fr: "Avis clients", ar: "آراء الزبائن" },
    title: { fr: "Ils ont habillé leurs murs", ar: "جدران غيّروها معنا" },
    subtitle: { fr: "Les avis de nos clients, publiés après vérification par notre équipe.", ar: "آراء زبائننا، تُنشر بعد مراجعتها من طرف فريقنا." },
  },
  "why.page": {
    title: { fr: "Pourquoi Boulboul", ar: "لماذا Boulboul" },
    intro: { fr: "Ce qui compte pour nous, de l'atelier à votre mur.", ar: "ما يهمّنا، من الورشة إلى جدارك." },
    pillars: [
      {
        title: { fr: "Personnalisation", ar: "التخصيص" },
        text: {
          fr: "Dimensions, cadre et options : la plupart de nos créations s'adaptent à votre mur, et vous pouvez nous envoyer votre propre design.",
          ar: "المقاسات والإطار والإضافات: معظم تصاميمنا تتكيّف مع جدارك، ويمكنك إرسال تصميمك الخاص.",
        },
        image: img("/brand/products/crown-wings-real.jpg"),
      },
      {
        title: { fr: "Fabriqué à la commande", ar: "يُصنع عند الطلب" },
        text: {
          fr: "Rien n'est produit en série : chaque pièce est fabriquée pour vous, après validation de votre commande.",
          ar: "لا شيء يُنتج بالجملة: كل قطعة تُصنع لك بعد تأكيد طلبك.",
        },
        image: img("/brand/products/luffy-workshop.jpg"),
      },
      {
        title: { fr: "Chaque commande confirmée avec vous", ar: "كل طلب يُؤكَّد معك" },
        text: {
          fr: "Aucun paiement en ligne : Boulboul vérifie chaque commande et vous contacte pour la confirmer avant de la préparer. Vous suivez son statut depuis votre compte.",
          ar: "لا دفع عبر الإنترنت: يتحقق Boulboul من كل طلب ويتصل بك لتأكيده قبل تحضيره. وتتابع حالته من حسابك.",
        },
        image: "",
      },
      {
        title: { fr: "Livraison dans toute l'Algérie", ar: "التوصيل إلى كل الجزائر" },
        text: {
          fr: "À domicile ou en stop desk, avec le tarif de votre wilaya affiché avant de commander. Plusieurs commandes avant livraison ? Elles partent dans le même colis, sans nouveaux frais.",
          ar: "إلى المنزل أو إلى نقطة الاستلام (stop desk)، مع سعر ولايتك ظاهر قبل الطلب. عدّة طلبات قبل التوصيل؟ تُرسل في نفس الطرد بدون مصاريف إضافية.",
        },
        image: "",
      },
      {
        title: { fr: "Retours & échanges", ar: "الإرجاع والاستبدال" },
        text: {
          fr: "Une demande de retour ou d'échange se fait directement depuis votre commande ; notre équipe l'étudie et vous répond.",
          ar: "طلب الإرجاع أو الاستبدال يتم مباشرة من صفحة طلبك؛ يدرسه فريقنا ويردّ عليك.",
        },
        image: "",
      },
    ],
    materials: { fr: "", ar: "" },
    production: { fr: "", ar: "" },
    guarantees: { fr: "", ar: "" },
    pricing: { fr: "", ar: "" },
    certifications: [],
  },
  "about.page": {
    title: { fr: "Qui est Boulboul", ar: "من هو Boulboul" },
    intro: {
      fr: "Un atelier de décoration murale qui transforme les idées en pièces uniques pour les maisons, les bureaux et les commerces.",
      ar: "ورشة ديكور جداري تحوّل الأفكار إلى قطع فريدة للبيوت والمكاتب والمحلات.",
    },
    story: {
      fr: "Chez Boulboul Art Wall, chaque mur est une page blanche. Miroirs LED, néons, tableaux, canvas ou compositions en volume : nous fabriquons chaque pièce à la commande, aux dimensions de votre espace, et nous accompagnons chaque client de l'idée jusqu'à la livraison.",
      ar: "في Boulboul Art Wall، كل جدار صفحة بيضاء. مرايا LED، نيون، لوحات، كانفاس أو تركيبات مجسّمة: نصنع كل قطعة عند الطلب وعلى مقاسات مساحتك، ونرافق كل زبون من الفكرة حتى التوصيل.",
    },
    storyImage: img("/brand/scenes/showroom-collection.jpg"),
    founders: [],
  },
  footer: {
    tagline: { fr: "Transformez vos murs.\nExprimez votre style.", ar: "غيّر جدرانك.\nعبّر عن أسلوبك." },
    copyright: { fr: "Boulboul Art Wall", ar: "Boulboul Art Wall" },
  },
};

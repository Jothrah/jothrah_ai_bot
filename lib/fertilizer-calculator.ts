export type FertilizerBotResponse = {
  language: "ar" | "en";
  analysis_source: "text" | "image" | "image_and_text";
  detected_problem: string;
  confidence: "high" | "medium" | "low";
  summary: string;
  advice: string[];
  questions: string[];
  categories: { title: string; url: string }[];
  product_suggestions: { name: string; url: string; reason: string }[];
  whatsapp_needed: boolean;
  whatsapp_message: string;
};

type BuildParams = {
  message: string;
  recentContext?: string;
  language: "ar" | "en";
  analysisSource?: "text" | "image" | "image_and_text";
  forceWhatsapp?: boolean;
};

type CropType = "vegetables" | "field" | "fruit" | "greenhouse" | "ornamental";
type FertilizerForm = "granular" | "soluble" | "liquid" | "unknown";
type ApplicationMethod = "broadcast" | "irrigation" | "foliar" | "unknown";
type Unit = "جم" | "مل" | "كجم" | "لتر";

type NpkFormula = { n: number; p: number; k: number; label: string };
type RateBasis = "kg_per_ha" | "liter_per_ha" | "kg_per_1000m2" | "liter_per_1000m2" | "kg_per_1000l_per_ha" | "liter_per_1000l_per_ha" | "g_per_1000l_per_ha" | "ml_per_1000l_per_ha" | "kg_per_tree";

type Rate = {
  min: number;
  max: number;
  unit: Unit;
  basis: RateBasis;
  label: string;
  method: ApplicationMethod;
  note?: string;
};

type FertilizerType = {
  id: string;
  arName: string;
  aliases: string[];
  defaultForm: FertilizerForm;
  rates: Rate[];
  notes?: string[];
};

type ComponentKey =
  | "phosphorus"
  | "calcium"
  | "zinc"
  | "micronutrients"
  | "magnesium"
  | "copper"
  | "sulfur"
  | "humic"
  | "fulvic"
  | "acid"
  | "urea"
  | "calcium_nitrate"
  | "potassium_nitrate"
  | "oil";

function toEnglishDigits(value: string) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "")
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
}

function normalizeArabic(value: string) {
  return toEnglishDigits(value)
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[]/g, "")
    .replace(/[؟?،,؛;:.()\[\]{}]/g, " ")
    .replace(/[–—_]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text: string, terms: string[]) {
  const normalized = normalizeArabic(text);
  return terms.some((term) => normalized.includes(normalizeArabic(term)));
}


function customerOnlyContext(value: string) {
  const lines = String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const picked: string[] = [];

  for (const line of lines) {
    const raw = line.trim();
    const normalized = normalizeArabic(raw);

    // Check raw labels before normalization because normalizeArabic removes the colon.
    if (/^\s*(المساعد|Assistant)\s*:/i.test(raw)) continue;

    if (/^\s*(العميل|Customer)\s*:/i.test(raw)) {
      picked.push(raw.replace(/^\s*(العميل|Customer)\s*:\s*/i, ""));
      continue;
    }

    if (
      normalized.startsWith("المساعد ") ||
      normalized.includes("تشخيص مبدئي") ||
      normalized.includes("نصائح مباشرة") ||
      normalized.includes("تصنيفات مناسبة") ||
      normalized.includes("initial diagnosis") ||
      normalized.includes("direct advice")
    ) continue;

    picked.push(raw);
  }

  return picked.join("\n");
}

function firstKnownForm(current: string, context: string): FertilizerForm {
  const currentForm = detectFertilizerForm(current);
  if (currentForm !== "unknown") return currentForm;
  return detectFertilizerForm(context);
}

function firstKnownMethod(current: string, context: string): ApplicationMethod {
  const currentMethod = detectApplicationMethod(current);
  if (currentMethod !== "unknown") return currentMethod;
  return detectApplicationMethod(context);
}

function roundSmart(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) >= 100) return Math.round(value);
  if (Math.abs(value) >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number) {
  return String(roundSmart(value));
}

function formatRange(min: number, max: number, unit: Unit) {
  if ((unit === "جم" || unit === "مل") && (min >= 1000 || max >= 1000)) {
    const newUnit = unit === "جم" ? "كجم" : "لتر";
    return `${formatNumber(min / 1000)}–${formatNumber(max / 1000)} ${newUnit}`;
  }
  return `${formatNumber(min)}–${formatNumber(max)} ${unit}`;
}

function extractAreaM2(text: string): number | null {
  const normalized = normalizeArabic(text)
    .replace(/متر مربع/g, "م2")
    .replace(/مترمربع/g, "م2")
    .replace(/م²/g, "م2")
    .replace(/متر٢/g, "م2")
    .replace(/متر 2/g, "م2");

  const hectare = normalized.match(/(\d+(?:\.\d+)?)\s*(?:هكتار|هكتارات)/);
  if (hectare?.[1]) return Number(hectare[1]) * 10000;

  const dunum = normalized.match(/(\d+(?:\.\d+)?)\s*(?:دونم|دونمات)/);
  if (dunum?.[1]) return Number(dunum[1]) * 1000;

  const patterns = [
    /(?:مساحه|مساحة|على مساحة|مزرعه مساحة|مزرعة مساحة|ارض مساحة|أرض مساحة)\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*(?:م2|متر|متر مربع|م²)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }

  return null;
}

function extractTankLiters(text: string): number | null {
  const normalized = normalizeArabic(text);
  const match = normalized.match(/(?:رشاشه|رشاشة|خزان|تنك|مرش)\s*(\d+(?:\.\d+)?)\s*(?:لتر|لترات)?|(?:لتر|لترات)\s*(\d+(?:\.\d+)?)/);
  const value = match?.[1] || match?.[2];
  return value ? Number(value) : null;
}

function extractRatePerLiter(text: string): { amount: number; unit: "جم" | "مل" } | null {
  const normalized = normalizeArabic(text);
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(جم|غرام|جرام|غ|مل|ملي|ملل)\s*(?:لكل|\/|في|على)?\s*(?:1\s*)?لتر/);
  if (!match?.[1] || !match?.[2]) return null;
  const unit = ["مل", "ملي", "ملل"].includes(match[2]) ? "مل" : "جم";
  return { amount: Number(match[1]), unit };
}

function extractTrees(text: string): number | null {
  const normalized = normalizeArabic(text);
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:شجره|شجرة|اشجار|أشجار|نخله|نخلة|نخلات|نخيل)/);
  return match?.[1] ? Number(match[1]) : null;
}

function extractNpkFormula(text: string): NpkFormula | null {
  const normalized = normalizeArabic(text).replace(/\s+/g, " ");
  const match = normalized.match(/(\d{1,2}(?:\.\d+)?)\s*-\s*(\d{1,2}(?:\.\d+)?)\s*-\s*(\d{1,2}(?:\.\d+)?)/);
  if (!match?.[1] || !match?.[2] || !match?.[3]) return null;

  const n = Number(match[1]);
  const p = Number(match[2]);
  const k = Number(match[3]);
  if (![n, p, k].every(Number.isFinite)) return null;

  return { n, p, k, label: `${formatNumber(n)}-${formatNumber(p)}-${formatNumber(k)}` };
}

function detectNpk(text: string) {
  const normalized = normalizeArabic(text);
  return (
    Boolean(extractNpkFormula(normalized)) ||
    normalized.includes("npk") ||
    normalized.includes("ان بي كي") ||
    normalized.includes("انبيكي") ||
    normalized.includes("سماد مركب") ||
    normalized.includes("سماد متوازن") ||
    normalized.includes("العناصر الكبري") ||
    normalized.includes("العناصر الكبرى")
  );
}

function detectFertilizerForm(text: string): FertilizerForm {
  const normalized = normalizeArabic(text);

  if (containsAny(normalized, [
    "محبب", "حبيبات", "حبيبه", "حبيبة", "جرانول", "granular", "granule", "granules",
    "نثر", "نثرا", "ينثر", "نثره", "صلب للتربه", "صلب للتربة", "سماد محبي", "سماد حبيبي"
  ])) return "granular";

  if (containsAny(normalized, ["سائل", "لتر", "مل", "ملي", "liquid"])) return "liquid";

  if (containsAny(normalized, [
    "ذواب", "ذائب", "يذوب", "اذوبه", "اذوب", "بودر", "مع ماء الري", "ماء الري", "رش ورقي", "رش", "spray", "soluble", "water soluble"
  ])) return "soluble";

  return "unknown";
}

function detectApplicationMethod(text: string): ApplicationMethod {
  const normalized = normalizeArabic(text);
  if (containsAny(normalized, ["نثر", "نثرا", "ينثر", "محبب", "حبيبات", "حول الجذور", "على التربه", "على التربة"])) return "broadcast";
  if (containsAny(normalized, ["رش ورقي", "رش", "ورقي", "بخاخ", "رشاشه", "رشاشة", "foliar", "spray"])) return "foliar";
  if (containsAny(normalized, ["ماء الري", "مع الري", "ري", "تنقيط", "خزان", "irrigation"])) return "irrigation";
  return "unknown";
}

function detectCropType(text: string): CropType | null {
  const normalized = normalizeArabic(text);

  if (containsAny(normalized, ["بيت محمي", "بيوت محميه", "بيوت محمية", "صوبه", "صوبة", "محمي", "محمية"])) return "greenhouse";
  if (containsAny(normalized, ["خيار", "طماطم", "بندوره", "بندورة", "فلفل", "كوسه", "كوسة", "خضار", "خضروات", "باذنجان", "ورقيات", "ملوخيه", "ملوخية", "خس", "جرجير", "بصل", "بطاطس"])) return "vegetables";
  if (containsAny(normalized, ["نخيل", "نخله", "نخلة", "حمضيات", "ليمون", "برتقال", "عنب", "رمان", "مانجو", "زيتون", "فاكهه", "فاكهة", "اشجار", "أشجار", "شجره", "شجرة"])) return "fruit";
  if (containsAny(normalized, ["قمح", "شعير", "ذره", "ذرة", "برسيم", "محاصيل حقليه", "حقلية", "حقل", "مزرعه", "مزرعة"])) return "field";
  if (containsAny(normalized, ["زينه", "زينة", "ورد", "زهور", "نباتات زينه", "نباتات زينة", "داخلي", "نبات داخلي", "بوتس", "صبار"])) return "ornamental";

  return null;
}

function cropLabel(crop: CropType | null, language: "ar" | "en") {
  if (language === "en") {
    if (crop === "vegetables") return "vegetable crops";
    if (crop === "field") return "field crops";
    if (crop === "fruit") return "fruit crops";
    if (crop === "greenhouse") return "greenhouse crops";
    if (crop === "ornamental") return "ornamental plants";
    return "unspecified crop";
  }

  if (crop === "vegetables") return "محاصيل الخضار";
  if (crop === "field") return "المحاصيل الحقلية";
  if (crop === "fruit") return "محاصيل الفاكهة";
  if (crop === "greenhouse") return "البيوت المحمية";
  if (crop === "ornamental") return "نباتات الزينة";
  return "محصول غير محدد";
}

const NPK_SOLUBLE_IRRIGATION_RATES: Record<CropType, Rate> = {
  field: { min: 4, max: 6, unit: "كجم", basis: "kg_per_ha", label: "4–6 كجم / هكتار", method: "irrigation" },
  vegetables: { min: 5, max: 7, unit: "كجم", basis: "kg_per_ha", label: "5–7 كجم / هكتار", method: "irrigation" },
  fruit: { min: 6, max: 8, unit: "كجم", basis: "kg_per_ha", label: "6–8 كجم / هكتار", method: "irrigation" },
  greenhouse: { min: 1, max: 2, unit: "كجم", basis: "kg_per_1000m2", label: "1–2 كجم / 1000 م²", method: "irrigation" },
  ornamental: { min: 3, max: 4, unit: "كجم", basis: "kg_per_ha", label: "3–4 كجم / هكتار", method: "irrigation" },
};

const NPK_SOLUBLE_FOLIAR_RATE: Rate = {
  min: 2,
  max: 3,
  unit: "كجم",
  basis: "kg_per_1000l_per_ha",
  label: "2–3 كجم / 1000 لتر / هكتار",
  method: "foliar",
};

const GRANULAR_SOLID_RATES = {
  fieldBroadcast: { min: 150, max: 300, unit: "كجم" as Unit, basis: "kg_per_ha" as RateBasis, label: "150–300 كجم / هكتار", method: "broadcast" as ApplicationMethod },
  greenhouseBroadcast: { min: 15, max: 30, unit: "كجم" as Unit, basis: "kg_per_1000m2" as RateBasis, label: "15–30 كجم / 1000 م²", method: "broadcast" as ApplicationMethod },
  fruitTree: { min: 0.25, max: 1, unit: "كجم" as Unit, basis: "kg_per_tree" as RateBasis, label: "0.25–1 كجم / شجرة", method: "broadcast" as ApplicationMethod },
  palmTree: { min: 0.5, max: 1, unit: "كجم" as Unit, basis: "kg_per_tree" as RateBasis, label: "0.5–1 كجم / نخلة", method: "broadcast" as ApplicationMethod },
};

const FERTILIZER_TYPES: FertilizerType[] = [
  {
    id: "phosphoric_acid",
    arName: "حامض الفوسفوريك",
    aliases: ["حامض الفوسفوريك", "حمض الفوسفوريك", "فوسفوريك", "phosphoric acid"],
    defaultForm: "liquid",
    rates: [
      { min: 2, max: 3, unit: "لتر", basis: "liter_per_ha", label: "2–3 لتر / هكتار مع ماء الري", method: "irrigation" },
      { min: 0.5, max: 1, unit: "لتر", basis: "liter_per_1000l_per_ha", label: "0.5–1 لتر / 1000 لتر ماء / هكتار للرش الورقي", method: "foliar" },
    ],
    notes: ["يفضل إضافته منفردًا ولا يخلط مع الكالسيوم والمغنيسيوم والنحاس والهيوميك."],
  },
  {
    id: "micronutrients_solid",
    arName: "العناصر الصغرى الذوابة",
    aliases: ["عناصر صغرى", "العناصر الصغرى", "حديد", "زنك", "منجنيز", "منغنيز", "نحاس", "بورون", "موليبدنم", "مخلب", "edta", "eddha"],
    defaultForm: "soluble",
    rates: [
      { min: 0.5, max: 1, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "0.5–1 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
      { min: 2, max: 2, unit: "كجم", basis: "kg_per_ha", label: "2 كجم / هكتار مع ماء الري", method: "irrigation" },
    ],
    notes: ["إذا كان البورون أعلى من 2% فالمرجع الورقي 350–450 جم / 1000 لتر / هكتار."],
  },
  {
    id: "micronutrients_liquid",
    arName: "العناصر الصغرى السائلة",
    aliases: ["عناصر صغرى سائلة", "حديد سائل", "زنك سائل", "ميكرو سائل"],
    defaultForm: "liquid",
    rates: [
      { min: 0.5, max: 1, unit: "لتر", basis: "liter_per_1000l_per_ha", label: "0.5–1 لتر / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
      { min: 2, max: 2, unit: "لتر", basis: "liter_per_ha", label: "2 لتر / هكتار مع ماء الري", method: "irrigation" },
    ],
  },
  {
    id: "humic_fulvic_solid",
    arName: "الهيوميك والفولفيك الذائب",
    aliases: ["هيوميك", "هيومك", "فولفيك", "فلفيك", "humic", "fulvic"],
    defaultForm: "soluble",
    rates: [
      { min: 2, max: 4, unit: "كجم", basis: "kg_per_ha", label: "2–4 كجم / هكتار مع ماء الري", method: "irrigation" },
      { min: 1, max: 1.5, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "1–1.5 كجم / 1000 لتر / هكتار للرش الورقي إذا كان الفولفيك محملًا على عناصر", method: "foliar" },
    ],
    notes: ["الهيوميك لا يقبل الخلط مع الأحماض أو التركيز العالي من الكالسيوم."],
  },
  {
    id: "humic_granular",
    arName: "الهيوميك المحبب غير الذواب",
    aliases: ["هيوميك محبب", "هيوميك حبيبات", "هيوميك غير ذواب"],
    defaultForm: "granular",
    rates: [
      { min: 25, max: 50, unit: "كجم", basis: "kg_per_ha", label: "25–50 كجم / هكتار نثرًا", method: "broadcast" },
      { min: 5, max: 5, unit: "كجم", basis: "kg_per_1000m2", label: "5 كجم / 1000 م² للبيوت المحمية", method: "broadcast" },
    ],
  },
  {
    id: "seaweed",
    arName: "الطحالب البحرية",
    aliases: ["طحالب", "طحالب بحرية", "سي ويد", "seaweed", "algae"],
    defaultForm: "soluble",
    rates: [
      { min: 0.5, max: 1, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "0.5–1 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
  },
  {
    id: "amino_acids",
    arName: "الأحماض الأمينية",
    aliases: ["احماض امينية", "أحماض أمينية", "امينو", "أمينو", "amino"],
    defaultForm: "liquid",
    rates: [
      { min: 1, max: 1.5, unit: "لتر", basis: "liter_per_1000l_per_ha", label: "1–1.5 لتر / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
      { min: 2.5, max: 3.5, unit: "كجم", basis: "kg_per_ha", label: "2.5–3.5 كجم / هكتار في الري الأرضي", method: "irrigation" },
    ],
  },
  {
    id: "calcium_complex",
    arName: "الكالسيوم المعقد مع أحماض أمينية أو ستريك أو جلوكونات",
    aliases: ["كالسيوم معقد", "كالسيوم جلوكونات", "كالسيوم ستريك", "كالسيوم احماض امينية", "كالسيوم أحماض أمينية"],
    defaultForm: "liquid",
    rates: [
      { min: 1.5, max: 2, unit: "لتر", basis: "liter_per_1000l_per_ha", label: "1.5–2 لتر / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
  },
  {
    id: "urea",
    arName: "اليوريا",
    aliases: ["يوريا", "اليوريا", "urea"],
    defaultForm: "soluble",
    rates: [
      { min: 2, max: 4, unit: "كجم", basis: "kg_per_ha", label: "2–4 كجم / هكتار مع ماء الري", method: "irrigation" },
      { min: 2, max: 2, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "2 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
    notes: ["لا تقبل الخلط مع نترات الكالسيوم.", "في الأسمدة المحتوية على يوريا لا تزيد نسبة البيوريت عن 1%."],
  },
  {
    id: "potassium_nitrate",
    arName: "نترات البوتاسيوم",
    aliases: ["نترات البوتاسيوم", "نترات بوتاسيوم", "potassium nitrate"],
    defaultForm: "soluble",
    rates: [
      { min: 4, max: 7, unit: "كجم", basis: "kg_per_ha", label: "4–7 كجم / هكتار مع ماء الري", method: "irrigation" },
      { min: 2, max: 2, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "2 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
    notes: ["تقبل الخلط مع جميع الأسمدة حسب الدليل، مع تفضيل تجربة خلط صغيرة."],
  },
  {
    id: "calcium_nitrate",
    arName: "نترات الكالسيوم",
    aliases: ["نترات الكالسيوم", "نترات كالسيوم", "calcium nitrate"],
    defaultForm: "soluble",
    rates: [
      { min: 3, max: 5, unit: "كجم", basis: "kg_per_ha", label: "3–5 كجم / هكتار مع ماء الري", method: "irrigation" },
      { min: 2, max: 2, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "2 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
    notes: ["لا تقبل الخلط مع الفوسفور والكبريت واليوريا."],
  },
  {
    id: "potassium_sulfate",
    arName: "سلفات البوتاسيوم",
    aliases: ["سلفات بوتاسيوم", "سلفات البوتاسيوم", "كبريتات البوتاسيوم", "potassium sulfate"],
    defaultForm: "soluble",
    rates: [
      { min: 5, max: 8, unit: "كجم", basis: "kg_per_ha", label: "5–8 كجم / هكتار مع ماء الري", method: "irrigation" },
      { min: 2, max: 2, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "2 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
    notes: ["لا تقبل الخلط مع الكالسيوم."],
  },
  {
    id: "ammonium_sulfate",
    arName: "سلفات الأمونيوم",
    aliases: ["سلفات امونيوم", "سلفات أمونيوم", "سلفات الامونيوم", "كبريتات الامونيوم", "ammonium sulfate"],
    defaultForm: "soluble",
    rates: [
      { min: 3, max: 7, unit: "كجم", basis: "kg_per_ha", label: "3–7 كجم / هكتار مع ماء الري", method: "irrigation" },
      { min: 2, max: 2, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "2 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
    notes: ["لا تقبل الخلط مع الكالسيوم والفوسفور."],
  },
  {
    id: "magnesium_sulfate",
    arName: "سلفات المغنيسيوم",
    aliases: ["سلفات ماغنيسيوم", "سلفات مغنيسيوم", "كبريتات المغنيسيوم", "magnesium sulfate"],
    defaultForm: "soluble",
    rates: [
      { min: 3, max: 4, unit: "كجم", basis: "kg_per_ha", label: "3–4 كجم / هكتار مع ماء الري", method: "irrigation" },
      { min: 2, max: 2, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "2 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
    notes: ["لا تقبل الخلط مع حمض الفوسفوريك ونترات الكالسيوم."],
  },
  {
    id: "map",
    arName: "MAP",
    aliases: ["map", "ماب", "احادي فوسفات الامونيوم", "أحادي فوسفات الأمونيوم"],
    defaultForm: "soluble",
    rates: [
      { min: 4, max: 8, unit: "كجم", basis: "kg_per_ha", label: "4–8 كجم / هكتار مع ماء الري", method: "irrigation" },
      { min: 2, max: 2, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "2 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
    notes: ["لا يقبل الخلط مع الكالسيوم والنحاس والكبريت والمغنيسيوم."],
  },
  {
    id: "mkp",
    arName: "MKP",
    aliases: ["mkp", "ام كيه بي", "مونو بوتاسيوم فوسفات", "احادي فوسفات البوتاسيوم"],
    defaultForm: "soluble",
    rates: [
      { min: 5, max: 8, unit: "كجم", basis: "kg_per_ha", label: "5–8 كجم / هكتار مع ماء الري", method: "irrigation" },
      { min: 2, max: 2, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "2 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
    notes: ["لا يقبل الخلط مع الكالسيوم والنحاس والكبريت والمغنيسيوم."],
  },
  {
    id: "urea_phosphate",
    arName: "يوريا فوسفات",
    aliases: ["يوريا فوسفات", "بوريا فوسفات", "urea phosphate"],
    defaultForm: "soluble",
    rates: [
      { min: 4, max: 7, unit: "كجم", basis: "kg_per_ha", label: "4–7 كجم / هكتار مع ماء الري", method: "irrigation" },
      { min: 2, max: 2, unit: "كجم", basis: "kg_per_1000l_per_ha", label: "2 كجم / 1000 لتر / هكتار للرش الورقي", method: "foliar" },
    ],
    notes: ["لا يقبل الخلط مع الكالسيوم والنحاس والكبريت والمغنيسيوم."],
  },
  {
    id: "potassium_citrate",
    arName: "سترات البوتاسيوم",
    aliases: ["سترات البوتاسيوم", "سترات بوتاسيوم", "potassium citrate"],
    defaultForm: "liquid",
    rates: [
      { min: 2, max: 4, unit: "لتر", basis: "liter_per_ha", label: "2–4 لتر / هكتار مع ماء الري", method: "irrigation" },
      { min: 0.5, max: 1, unit: "لتر", basis: "liter_per_1000m2", label: "0.5–1 لتر / 1000 م² للبيوت المحمية", method: "irrigation" },
      { min: 1, max: 1.5, unit: "لتر", basis: "liter_per_1000l_per_ha", label: "1–1.5 لتر / 1000 لتر ماء / هكتار رشًا على الأوراق", method: "foliar" },
    ],
    notes: ["لا يقبل الخلط مع الكالسيوم ويفضل عمل تجربة قبل الخلط."],
  },
  {
    id: "potassium_thiosulfate",
    arName: "ثيو سلفات البوتاسيوم",
    aliases: ["ثيو سلفات البوتاسيوم", "ثيوسلفات البوتاسيوم", "ثيو سلفات بوتاسيوم", "potassium thiosulfate"],
    defaultForm: "liquid",
    rates: [
      { min: 4, max: 5, unit: "لتر", basis: "liter_per_ha", label: "4–5 لتر / هكتار مع ماء الري", method: "irrigation" },
      { min: 1, max: 1.5, unit: "لتر", basis: "liter_per_1000m2", label: "1–1.5 لتر / 1000 م² للبيوت المحمية", method: "irrigation" },
      { min: 1, max: 1.5, unit: "لتر", basis: "liter_per_1000l_per_ha", label: "1–1.5 لتر / 1000 لتر ماء / هكتار رشًا على الأوراق", method: "foliar" },
    ],
    notes: ["لا يقبل الخلط مع الكالسيوم ويفضل عمل تجربة قبل الخلط."],
  },
  {
    id: "sulfur",
    arName: "الكبريت الزراعي",
    aliases: ["كبريت زراعي", "الكبريت الزراعي", "sulfur", "sulphur"],
    defaultForm: "granular",
    rates: [
      { min: 500, max: 1000, unit: "كجم", basis: "kg_per_ha", label: "0.5–1 طن / هكتار / سنة", method: "broadcast" },
    ],
    notes: ["يضاف نثرًا مخلوطًا مع السماد العضوي في الطبقة السطحية للتربة."],
  },
  {
    id: "gypsum",
    arName: "الجبس الزراعي",
    aliases: ["جبس زراعي", "الجبس الزراعي", "gypsum"],
    defaultForm: "granular",
    rates: [
      { min: 1000, max: 2000, unit: "كجم", basis: "kg_per_ha", label: "1–2 طن / هكتار", method: "broadcast" },
    ],
  },
  {
    id: "organic_fertilizer",
    arName: "الأسمدة العضوية",
    aliases: ["سماد عضوي", "اسمدة عضوية", "أسمدة عضوية", "مخلفات حيوانية", "مخلفات نباتية", "organic fertilizer"],
    defaultForm: "granular",
    rates: [
      { min: 5000, max: 10000, unit: "كجم", basis: "kg_per_ha", label: "5–10 طن / هكتار", method: "broadcast" },
    ],
  },
  {
    id: "soil_treatment",
    arName: "أسمدة معالجة التربة",
    aliases: ["معالجة التربة", "معالج تربة", "محسن تربة سائل", "soil treatment"],
    defaultForm: "liquid",
    rates: [
      { min: 5, max: 7, unit: "لتر", basis: "liter_per_ha", label: "5–7 لتر / هكتار مع ماء الري", method: "irrigation" },
    ],
  },
];

function baseResponse(params: BuildParams, patch: Partial<FertilizerBotResponse>): FertilizerBotResponse {
  const language = params.language || "ar";
  const message = String(params.message || "").trim();

  return {
    language,
    analysis_source: params.analysisSource || "text",
    detected_problem: language === "ar" ? "استفسار أسمدة" : "Fertilizer inquiry",
    confidence: "high",
    summary: "",
    advice: [],
    questions: [],
    categories: [],
    product_suggestions: [],
    whatsapp_needed: Boolean(params.forceWhatsapp),
    whatsapp_message:
      language === "ar"
        ? `السلام عليكم، أحتاج مساعدة مختص جذرة في استفسار تسميد. الرسالة: ${message}`
        : `Hello, I need a Jothrah specialist for a fertilizer inquiry. Message: ${message}`,
    ...patch,
  };
}

function rateToAreaGrams(areaM2: number, rate: Rate): { min: number; max: number; unit: Unit; gramsOrMlPerM2Min: number; gramsOrMlPerM2Max: number } | null {
  let perM2Min: number;
  let perM2Max: number;
  let outputUnit: Unit = rate.unit;

  if (rate.basis === "kg_per_ha") {
    perM2Min = (rate.min * 1000) / 10000;
    perM2Max = (rate.max * 1000) / 10000;
    outputUnit = "جم";
  } else if (rate.basis === "liter_per_ha") {
    perM2Min = (rate.min * 1000) / 10000;
    perM2Max = (rate.max * 1000) / 10000;
    outputUnit = "مل";
  } else if (rate.basis === "kg_per_1000m2") {
    perM2Min = (rate.min * 1000) / 1000;
    perM2Max = (rate.max * 1000) / 1000;
    outputUnit = "جم";
  } else if (rate.basis === "liter_per_1000m2") {
    perM2Min = (rate.min * 1000) / 1000;
    perM2Max = (rate.max * 1000) / 1000;
    outputUnit = "مل";
  } else {
    return null;
  }

  return {
    min: roundSmart(perM2Min * areaM2),
    max: roundSmart(perM2Max * areaM2),
    unit: outputUnit,
    gramsOrMlPerM2Min: perM2Min,
    gramsOrMlPerM2Max: perM2Max,
  };
}

function calculateTreeDose(count: number, rate: Rate) {
  if (rate.basis !== "kg_per_tree") return null;
  return {
    min: roundSmart(count * rate.min * 1000),
    max: roundSmart(count * rate.max * 1000),
    unit: "جم" as Unit,
  };
}

function chooseRate(type: FertilizerType, method: ApplicationMethod, crop: CropType | null) {
  const rates = type.rates;

  if (method !== "unknown") {
    const exact = rates.find((rate) => rate.method === method);
    if (exact) return exact;
  }

  if (crop === "greenhouse") {
    const greenhouse = rates.find((rate) => rate.basis === "kg_per_1000m2" || rate.basis === "liter_per_1000m2");
    if (greenhouse) return greenhouse;
  }

  return rates[0] || null;
}

function findFertilizerTypes(text: string) {
  const normalized = normalizeArabic(text);

  return FERTILIZER_TYPES.filter((type) =>
    type.aliases.some((alias) => normalized.includes(normalizeArabic(alias))),
  );
}

function isFertilizerInquiry(text: string) {
  const normalized = normalizeArabic(text);

  return (
    detectNpk(normalized) ||
    findFertilizerTypes(normalized).length > 0 ||
    containsAny(normalized, [
      "سماد", "اسمده", "أسمدة", "تسميد", "محسن تربه", "محسن تربة", "محسنات التربة",
      "نقص", "اصفرار", "احتراق حواف", "ضعف نمو", "تزهير", "اثمار", "إثمار", "عفن الطرف الزهري",
      "ph", "الرقم الهيدروجيني", "صوديوم", "كلور", "بيوريت", "خلط", "جرعه", "جرعة", "معدل", "رش ورقي", "ماء الري"
    ])
  );
}

function isProductSelectionRequest(text: string) {
  return containsAny(text, [
    "وش اشتري", "وش أشتري", "اي منتج", "أي منتج", "افضل منتج", "أفضل منتج", "افضل سماد", "أفضل سماد",
    "رشح", "ارشح", "أرشح", "اعطني منتج", "عطني منتج", "ابغى منتج", "أبغى منتج", "ايش اشتري"
  ]);
}

function isDoseQuestion(text: string) {
  return containsAny(text, ["كم", "جرعه", "جرعة", "معدل", "احط", "أحط", "اضع", "أضع", "استخدم", "مساحه", "مساحة", "متر", "لتر", "لكل لتر", "رشاشه", "رشاشة"]);
}

function buildTankDoseResponse(params: BuildParams, tankLiters: number, rate: { amount: number; unit: "جم" | "مل" }) {
  const total = roundSmart(tankLiters * rate.amount);

  return baseResponse(params, {
    detected_problem: "حساب جرعة سماد حسب حجم الرشاشة",
    summary: `إذا كان معدل الملصق ${formatNumber(rate.amount)} ${rate.unit} لكل لتر، وحجم الرشاشة ${formatNumber(tankLiters)} لتر، فالكمية الإجمالية تكون ${formatNumber(total)} ${rate.unit}.`,
    advice: [
      `الحساب: ${formatNumber(tankLiters)} × ${formatNumber(rate.amount)} = ${formatNumber(total)} ${rate.unit}.`,
      "التزم بمعدل الملصق ولا ترفع الجرعة من نفسك.",
      "تجنب الرش وقت الظهيرة أو على نبات مجهد.",
    ],
    questions: [],
  });
}

function buildNpkResponse(params: BuildParams, customerContextText: string = "") {
  const current = normalizeArabic(params.message || "");
  const context = normalizeArabic(customerOnlyContext(customerContextText || params.recentContext || ""));

  // Current message has absolute priority. Context is used only for missing values.
  const areaM2 = extractAreaM2(current) ?? extractAreaM2(context);
  const crop = detectCropType(current) || detectCropType(context);
  const form = firstKnownForm(current, context);
  const method = firstKnownMethod(current, context);
  const formula = extractNpkFormula(current) || extractNpkFormula(context);
  const formulaLabel = formula?.label || "NPK";
  const treeCount = extractTrees(current) ?? extractTrees(context);

  if (form === "granular" || method === "broadcast") {
    if (crop === "fruit" && treeCount) {
      const calc = calculateTreeDose(treeCount, GRANULAR_SOLID_RATES.fruitTree);
      return baseResponse(params, {
        detected_problem: `حساب سماد NPK ${formulaLabel} محبب للأشجار`,
        summary: `سماد NPK ${formulaLabel} محبب، وحساب الأشجار يكون غالبًا حسب عدد الأشجار لا مساحة الأرض فقط. لعدد ${formatNumber(treeCount)} شجرة يكون المعدل الاسترشادي تقريبًا ${formatRange(calc!.min, calc!.max, calc!.unit)}.`,
        advice: [
          `المعدل المرجعي للمحاصيل البستانية: 0.25–1 كجم / شجرة حسب العمر والحجم.`,
          "ينثر السماد في محيط ظل الشجرة بعيدًا عن ملامسة الساق ثم يروى مباشرة.",
          "إذا كانت الأشجار صغيرة ابدأ بالحد الأقل، والمعدلات تختلف حسب تحليل التربة ومرحلة النمو.",
        ],
        questions: [],
      });
    }

    if (!areaM2) {
      return baseResponse(params, {
        detected_problem: `طريقة استخدام سماد NPK ${formulaLabel} محبب`,
        confidence: "medium",
        summary: `سماد NPK ${formulaLabel} محبب يستخدم غالبًا نثرًا على التربة ثم ري، وليس إذابة في الماء إلا إذا كان الملصق يذكر أنه ذواب بالكامل.`,
        advice: [
          "للحساب بالمساحة اكتب المساحة بالمتر المربع.",
          "المرجع العام للنثر للمحاصيل الحقلية ونحوها: 15–30 جم/م².",
          "لا تضع الحبيبات ملاصقة للساق أو الجذور المكشوفة.",
        ],
        questions: ["كم مساحة الأرض بالمتر المربع؟ وما نوع المحصول؟"],
      });
    }

    const rate = crop === "greenhouse" ? GRANULAR_SOLID_RATES.greenhouseBroadcast : GRANULAR_SOLID_RATES.fieldBroadcast;
    const calc = rateToAreaGrams(areaM2, rate);

    return baseResponse(params, {
      detected_problem: `حساب سماد NPK ${formulaLabel} محبب حسب المساحة`,
      summary: `سمادك NPK ${formulaLabel} محبب، لذلك لا يُعامل مثل السماد الذواب. لمساحة ${formatNumber(areaM2)} م² يكون المعدل الاسترشادي للنثر تقريبًا ${formatRange(calc!.min, calc!.max, calc!.unit)}.`,
      advice: [
        `المعدل المرجعي للأسمدة المحببة الصلبة للتربة: ${rate.label}${crop === "greenhouse" ? " للبيوت المحمية" : " = 15–30 جم/م²"}.`,
        `الحساب لمساحة ${formatNumber(areaM2)} م² = ${formatRange(calc!.min, calc!.max, calc!.unit)}.`,
        "طريقة الاستخدام: نثر متجانس حول منطقة الجذور أو بين الخطوط، تقليب خفيف في سطح التربة إن أمكن، ثم ري مباشرة. لا تذوبه إلا إذا كان الملصق يذكر أنه ذواب بالكامل.",
      ],
      questions: [],
    });
  }

  if (method === "foliar") {
    return baseResponse(params, {
      detected_problem: `معدل رش ورقي لسماد NPK ${formulaLabel}`,
      summary: `للرش الورقي، المعدل الاسترشادي لسماد NPK الذواب هو ${NPK_SOLUBLE_FOLIAR_RATE.label}.`,
      advice: [
        "هذا المعدل مرتبط بحجم ماء الرش للهكتار، وليس بالمساحة وحدها إذا لم تذكر كمية الماء.",
        "إذا كتبت حجم الرشاشة ومعدل الملصق لكل لتر أقدر أحسب الكمية مباشرة.",
        "لا ترش وقت الظهيرة أو على نبات مجهد.",
      ],
      questions: ["كم حجم الرشاشة باللتر؟ وهل الملصق يذكر جم/لتر؟"],
    });
  }

  if (!areaM2) {
    return baseResponse(params, {
      detected_problem: `حساب معدل سماد ${formulaLabel}`,
      confidence: "medium",
      summary: `أقدر أحسب سماد ${formulaLabel} بدقة، لكن أحتاج المساحة وطريقة الاستخدام: ذواب مع ماء الري، رش ورقي، أو محبب للنثر.`,
      advice: [
        "اكتب المساحة مثل: 50 م² أو 100 م².",
        "اكتب هل السماد محبب أو ذواب أو سائل، أو أرسل صورة الملصق.",
        "إذا كان الاستخدام رش ورقي، اكتب حجم الرشاشة أو معدل الملصق لكل لتر.",
      ],
      questions: ["كم المساحة؟ وهل السماد ذواب أم محبب؟"],
    });
  }

  if (!crop) {
    const examples: CropType[] = ["field", "vegetables", "fruit", "greenhouse", "ornamental"];
    const lines = examples.map((item) => {
      const calc = rateToAreaGrams(areaM2, NPK_SOLUBLE_IRRIGATION_RATES[item]);
      return `${cropLabel(item, "ar")}: ${formatRange(calc!.min, calc!.max, calc!.unit)}`;
    });

    return baseResponse(params, {
      detected_problem: `حساب معدل NPK ${formulaLabel} حسب المساحة`,
      confidence: "medium",
      summary: `لمساحة ${formatNumber(areaM2)} م² من سماد ${formulaLabel} الذواب مع ماء الري، تختلف الكمية حسب نوع المحصول.`,
      advice: [
        lines.slice(0, 3).join(" | "),
        lines.slice(3).join(" | "),
        "إذا كان السماد محببًا فاكتب محبب؛ لأن حسابه يكون نثرًا على التربة وليس بنفس معدل ماء الري.",
      ].filter(Boolean),
      questions: ["ما نوع المحصول؟ وهل السماد ذواب أم محبب؟"],
    });
  }

  const rate = NPK_SOLUBLE_IRRIGATION_RATES[crop];
  const calc = rateToAreaGrams(areaM2, rate);

  return baseResponse(params, {
    detected_problem: `حساب معدل NPK ${formulaLabel} حسب المساحة`,
    summary: `لـ ${cropLabel(crop, "ar")} على مساحة ${formatNumber(areaM2)} م²، المعدل الاسترشادي لسماد ${formulaLabel} الذواب مع ماء الري يكون تقريبًا ${formatRange(calc!.min, calc!.max, calc!.unit)}.`,
    advice: [
      `المعدل المرجعي: ${rate.label}.`,
      `الحساب لمساحة ${formatNumber(areaM2)} م² = ${formatRange(calc!.min, calc!.max, calc!.unit)}.`,
      "ابدأ بالحد الأقل إذا النبات صغير أو مجهد، والمعدلات تختلف حسب تحليل التربة والمياه ومرحلة النمو.",
    ],
    questions: [],
  });
}

function buildSpecificFertilizerRateResponse(params: BuildParams, type: FertilizerType, textForCalc: string) {
  const areaM2 = extractAreaM2(textForCalc);
  const treeCount = extractTrees(textForCalc);
  const crop = detectCropType(textForCalc);
  const method = detectApplicationMethod(textForCalc);
  const rate = chooseRate(type, method, crop);

  if (!rate) return null;

  if (areaM2 && ["kg_per_ha", "liter_per_ha", "kg_per_1000m2", "liter_per_1000m2"].includes(rate.basis)) {
    const calc = rateToAreaGrams(areaM2, rate);
    if (!calc) return null;

    return baseResponse(params, {
      detected_problem: `حساب معدل ${type.arName}`,
      summary: `لـ ${type.arName} على مساحة ${formatNumber(areaM2)} م²، المعدل الاسترشادي حسب المرجع هو تقريبًا ${formatRange(calc.min, calc.max, calc.unit)}.`,
      advice: [
        `المعدل المرجعي: ${rate.label}.`,
        `الحساب لمساحة ${formatNumber(areaM2)} م² = ${formatRange(calc.min, calc.max, calc.unit)}.`,
        ...(type.notes || []).slice(0, 2),
        "هذه المعدلات استرشادية وتختلف حسب تحليل التربة والمياه ونوع النبات ومرحلة النمو.",
      ].filter(Boolean),
      questions: [],
    });
  }

  if (treeCount && rate.basis === "kg_per_tree") {
    const calc = calculateTreeDose(treeCount, rate);
    if (!calc) return null;
    return baseResponse(params, {
      detected_problem: `حساب معدل ${type.arName} حسب عدد الأشجار`,
      summary: `لعدد ${formatNumber(treeCount)} شجرة، المعدل الاسترشادي من ${type.arName} يكون تقريبًا ${formatRange(calc.min, calc.max, calc.unit)}.`,
      advice: [
        `المعدل المرجعي: ${rate.label}.`,
        "وزع السماد بعيدًا عن ملامسة الساق ثم اروِ مباشرة.",
        ...(type.notes || []).slice(0, 2),
      ],
      questions: [],
    });
  }

  if (isDoseQuestion(textForCalc)) {
    return baseResponse(params, {
      detected_problem: `معدل استخدام ${type.arName}`,
      confidence: "medium",
      summary: `المعدل الاسترشادي لـ ${type.arName}: ${rate.label}.`,
      advice: [
        areaM2 ? "لم أتمكن من تحويل المعدل للمساحة بسبب طريقة استخدام مرتبطة بحجم ماء الرش أو عدد الأشجار." : "للحساب الرقمي اكتب المساحة بالمتر المربع أو حجم الرشاشة/الخزان حسب طريقة الاستخدام.",
        ...(type.notes || []).slice(0, 2),
        "اتبع الملصق ولا ترفع الجرعة من نفسك.",
      ],
      questions: rate.basis.includes("1000l") ? ["كم حجم ماء الرش أو الرشاشة باللتر؟"] : ["كم المساحة أو عدد الأشجار؟"],
    });
  }

  return baseResponse(params, {
    detected_problem: `معلومات عامة عن ${type.arName}`,
    summary: `${type.arName}: المعدل الاسترشادي الأساسي هو ${rate.label}.`,
    advice: [
      ...(type.notes || []).slice(0, 3),
      "اكتب المساحة أو حجم الرشاشة إذا تبغى أحسبها لك بالأرقام.",
      "لا يتم ترشيح منتج محدد هنا؛ لتحديد المنتج الأنسب تواصل مع مختص جذرة.",
    ],
    questions: [],
  });
}

function detectComponents(text: string): Set<ComponentKey> {
  const normalized = normalizeArabic(text);
  const out = new Set<ComponentKey>();

  if (detectNpk(normalized) || containsAny(normalized, ["فوسفور", "فوسفوريك", "map", "mkp", "ماب", "ام كيه بي", "يوريا فوسفات"])) out.add("phosphorus");
  if (containsAny(normalized, ["كالسيوم", "نترات الكالسيوم", "نترات كالسيوم"])) out.add("calcium");
  if (containsAny(normalized, ["نترات الكالسيوم", "نترات كالسيوم"])) out.add("calcium_nitrate");
  if (containsAny(normalized, ["زنك", "الزنك", "zn"])) out.add("zinc");
  if (containsAny(normalized, ["حديد", "منجنيز", "منغنيز", "نحاس", "بورون", "موليبدنم", "عناصر صغري", "عناصر صغرى", "ميكرو"])) out.add("micronutrients");
  if (containsAny(normalized, ["نحاس", "النحاس", "cu"])) out.add("copper");
  if (containsAny(normalized, ["مغنيسيوم", "ماغنيسيوم", "mg"])) out.add("magnesium");
  if (containsAny(normalized, ["كبريت", "الكبريت", "سلفات", "sulfur", "sulphur"])) out.add("sulfur");
  if (containsAny(normalized, ["هيوميك", "humic"])) out.add("humic");
  if (containsAny(normalized, ["فولفيك", "fulvic"])) out.add("fulvic");
  if (containsAny(normalized, ["حمض", "احماض", "أحماض", "فوسفوريك", "ستريك", "حامض"])) out.add("acid");
  if (containsAny(normalized, ["يوريا", "اليوريا", "urea"])) out.add("urea");
  if (containsAny(normalized, ["نترات بوتاسيوم", "نترات البوتاسيوم", "potassium nitrate"])) out.add("potassium_nitrate");
  if (containsAny(normalized, ["زيت", "زيوت", "زيت معدني", "زيوت معدنيه", "mineral oil"])) out.add("oil");

  return out;
}

function isMixingQuestionCurrent(message: string) {
  const normalized = normalizeArabic(message);
  const components = detectComponents(normalized);
  const hasMixWord = containsAny(normalized, [
    "اخلط", "أخلط", "خلط", "الخلط", "اخلص", "ينفع", "اقدر", "أقدر", "مع بعض", "سوا", "سوى", "معاه", "معه", "مع ", "معا"
  ]);

  return hasMixWord && components.size >= 2 && !isDoseQuestion(normalized);
}

function buildMixingResponse(params: BuildParams) {
  const current = normalizeArabic(params.message || "");
  const components = detectComponents(current);

  if (!isMixingQuestionCurrent(current)) return null;

  const hasPhosphorus = components.has("phosphorus");
  const hasCalcium = components.has("calcium");
  const hasZincOrMicro = components.has("zinc") || components.has("micronutrients");
  const hasMagnesium = components.has("magnesium");
  const hasCopper = components.has("copper");
  const hasSulfur = components.has("sulfur");
  const hasHumic = components.has("humic");
  const hasFulvic = components.has("fulvic");
  const hasAcid = components.has("acid");
  const hasUrea = components.has("urea");
  const hasCalciumNitrate = components.has("calcium_nitrate");
  const hasOil = components.has("oil");

  if (hasOil) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط الزيوت المعدنية مع الأسمدة",
      summary: "الزيوت المعدنية لا تخلط مع أي سماد حسب قاعدة الخلط العامة، والأفضل استخدامها منفردة وفق الملصق.",
      advice: ["افصل الزيت المعدني عن الأسمدة.", "اعمل تجربة خلط فقط عندما يكون الملصق يسمح، وإلا لا تخلط.", "لا ترش وقت الحرارة العالية."],
      questions: [],
    });
  }

  if (hasCalcium && hasZincOrMicro) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط الكالسيوم مع الزنك أو العناصر الصغرى",
      summary: "لا تخلط الكالسيوم مع الزنك أو العناصر الصغرى في نفس الخزان. الأفضل فصل التطبيق حتى لا يحدث تعارض أو ضعف استفادة.",
      advice: ["استخدم الكالسيوم في رية أو رشة مستقلة، والزنك في موعد منفصل.", "إذا كان التطبيق ورقيًا، اترك فاصلًا مناسبًا حسب حالة النبات والملصق.", "اعمل تجربة خلط صغيرة قبل أي خلط غير مؤكد."],
      questions: ["هل الاستخدام رش ورقي أو مع ماء الري؟"],
    });
  }

  if (hasPhosphorus && hasCalcium) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط الفوسفور أو NPK مع الكالسيوم",
      summary: "لا تخلط NPK أو أي مركب يحتوي على الفوسفور مع الكالسيوم في نفس الخزان، لأن الفوسفور لا يقبل الخلط مع الكالسيوم وقد يحدث ترسيب أو ضعف في الاستفادة.",
      advice: ["أضف كل مركب في وقت منفصل أو خزان مستقل.", "يفضل عمل تجربة خلط صغيرة قبل أي خلط للأسمدة.", "إذا عندك جدول تسميد محدد، أرسله لمختص جذرة لمراجعته قبل التطبيق."],
      questions: [],
    });
  }

  if (hasPhosphorus && (hasMagnesium || hasCopper || hasSulfur)) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط مركبات الفوسفور",
      summary: "المركبات التي تحتوي على الفوسفور مثل NPK أو MAP أو MKP لا تقبل الخلط مع المغنيسيوم أو النحاس أو الكبريت.",
      advice: ["افصل الإضافة ولا تخلطها في نفس الخزان.", "اتبع قابلية الخلط المكتوبة على الملصق.", "اعمل تجربة خلط صغيرة إذا كان الخلط ضروريًا."],
      questions: [],
    });
  }

  if (hasCalcium && hasSulfur) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط الكالسيوم مع الكبريت",
      summary: "الكالسيوم لا يقبل الخلط مع الكبريت. افصل الإضافة بينهما.",
      advice: ["استخدم كل مركب في وقت مستقل.", "لا تخلط في الخزان إذا لم يذكر الملصق السماح بذلك.", "يفضل تجربة خلط صغيرة عند أي حالة غير واضحة."],
      questions: [],
    });
  }

  if (hasHumic && hasAcid) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط الهيوميك مع الأحماض",
      summary: "الهيوميك لا يقبل الخلط مع الأحماض، ويفضل إضافته منفردًا أو حسب تعليمات الملصق.",
      advice: ["افصل الهيوميك عن الأحماض في خزان مستقل.", "لا تخلط الهيوميك مع تركيز عالٍ من الكالسيوم.", "اعمل تجربة خلط صغيرة قبل أي خلط."],
      questions: [],
    });
  }

  if (hasFulvic && containsAny(current, ["ph عالي", "رقم هيدروجيني عالي", "قلوي", "قاعدي"])) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط الفولفيك مع المركبات القلوية",
      summary: "الفولفيك لا يقبل الخلط مع المركبات ذات الرقم الهيدروجيني العالي.",
      advice: ["افصل الفولفيك عن المركبات القلوية.", "راجع pH محلول الرش أو الري.", "اعمل تجربة خلط صغيرة قبل الخلط."],
      questions: [],
    });
  }

  if (hasUrea && hasCalciumNitrate) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط اليوريا مع نترات الكالسيوم",
      summary: "اليوريا 46% لا تقبل الخلط مع نترات الكالسيوم. الأفضل فصل الإضافة.",
      advice: ["استخدم كل سماد في وقت منفصل.", "اتبع طريقة الاستخدام المكتوبة على الملصق.", "لا ترفع الجرعة لتعويض الفصل بين الإضافات."],
      questions: [],
    });
  }

  return baseResponse(params, {
    detected_problem: "قابلية خلط الأسمدة",
    confidence: "medium",
    summary: "قابلية الخلط تختلف حسب تركيب السماد وتركيزه ودرجة الحموضة. لا تعتمد على الخلط إلا إذا كان الملصق يسمح بذلك.",
    advice: ["اعمل تجربة خلط صغيرة قبل الخلط في الخزان.", "افصل المركبات غير المؤكدة في إضافات مستقلة.", "أرسل صورة الملصق إذا رغبت بمراجعة الخلط بدقة."],
    questions: ["ما أسماء الأسمدة كاملة أو صورة ملصقاتها؟"],
  });
}

function buildYellowingResponse(params: BuildParams) {
  const current = normalizeArabic(params.message || "");
  if (!containsAny(current, ["اصفرار", "اصفر", "صفراء", "ورق اصفر", "الاوراق صفراء", "الأوراق صفراء", "chlorosis", "yellow"])) return null;

  const newLeaves = containsAny(current, ["حديثه", "حديثة", "الجديد", "الجديدة", "قمه", "قمة", "اعلى", "أعلى"]);
  const oldLeaves = containsAny(current, ["قديمه", "قديمة", "السفل", "اسفل", "أسفل", "تحت"]);

  if (newLeaves) {
    return baseResponse(params, {
      detected_problem: "اصفرار الأوراق الحديثة",
      summary: "اصفرار الأوراق الحديثة غالبًا يرتبط بعناصر لا تتحرك بسهولة داخل النبات، وأشهرها الحديد، وقد يتأثر أيضًا بارتفاع pH أو مشاكل الجذور والري.",
      advice: ["افحص pH ماء الري أو التربة إن أمكن.", "تأكد من عدم وجود زيادة ري أو اختناق جذور.", "لا تستخدم عنصرًا عشوائيًا قبل معرفة مكان الاصفرار وشكل العروق."],
      questions: ["هل العروق تبقى خضراء والاصفرار بين العروق؟ وما نوع النبات؟"],
    });
  }

  if (oldLeaves) {
    return baseResponse(params, {
      detected_problem: "اصفرار الأوراق القديمة",
      summary: "اصفرار الأوراق القديمة غالبًا يرتبط بعناصر متحركة مثل النيتروجين أو المغنيسيوم أو البوتاسيوم، لكن الحكم النهائي يحتاج صورة ومعلومات الري والتسميد.",
      advice: ["راجع آخر تسميد نيتروجين/مغنيسيوم.", "افحص انتظام الري وعدم تراكم الأملاح.", "ارفع صورة للورقة كاملة مع النبات لتحديد النمط."],
      questions: ["هل الاصفرار يبدأ من أسفل النبات؟ وهل معه احتراق حواف؟"],
    });
  }

  return baseResponse(params, {
    detected_problem: "اصفرار الأوراق",
    confidence: "medium",
    summary: "اصفرار الأوراق له أكثر من سبب، ولا يصح تحديد السماد مباشرة قبل معرفة مكان الاصفرار ونمطه.",
    advice: ["إذا كان الاصفرار في الأوراق الحديثة فقد يكون مرتبطًا بالحديد أو pH أو الجذور.", "إذا كان في الأوراق القديمة فقد يكون مرتبطًا بالنيتروجين أو المغنيسيوم أو البوتاسيوم.", "ارفع صورة واضحة أو اكتب: الاصفرار في الأوراق الجديدة أو القديمة؟"],
    questions: ["الاصفرار في الأوراق الجديدة أعلى النبات أم القديمة أسفل النبات؟"],
  });
}

function buildComplianceResponse(params: BuildParams) {
  const current = normalizeArabic(params.message || "");
  if (!containsAny(current, ["ph", "الرقم الهيدروجيني", "صوديوم", "كلور", "كلوريد", "بيوريت", "كادميوم", "رصاص", "زئبق", "زرنيخ", "نيكل", "ملوثات", "نانو", "تسجيل سماد", "مسموح"])) return null;

  if (containsAny(current, ["بيوريت", "biuret"])) {
    return baseResponse(params, {
      detected_problem: "حد البيوريت في الأسمدة المحتوية على يوريا",
      summary: "في الأسمدة التي تحتوي على يوريا، يجب ألا تزيد نسبة البيوريت عن 1% حسب الاشتراطات الواردة في الدليل.",
      advice: ["راجع شهادة التحليل أو الملصق.", "ارتفاع البيوريت قد يسبب ضررًا للنبات خصوصًا في الاستخدام الورقي.", "إذا لم تكن النسبة واضحة، أرسل صورة الملصق أو التحليل."],
      questions: [],
    });
  }

  if (containsAny(current, ["كلور", "كلوريد", "cl"])) {
    return baseResponse(params, {
      detected_problem: "حد الكلور في الأسمدة",
      summary: "القاعدة العامة في الدليل: لا تزيد نسبة الكلور في جميع أنواع الأسمدة عن 2%.",
      advice: ["راجع بند Cl أو Chloride في الملصق أو شهادة التحليل.", "النباتات الحساسة للأملاح تحتاج حذرًا أكبر.", "إذا عندك صورة الملصق أرسلها للمراجعة."],
      questions: [],
    });
  }

  if (containsAny(current, ["صوديوم", "na"])) {
    return baseResponse(params, {
      detected_problem: "حد الصوديوم في الأسمدة",
      summary: "حد الصوديوم يختلف حسب نوع المادة: في أسمدة العناصر الكبرى الحد 2%، وفي الأحماض الأمينية والهيوميك والفولفيك 2%، بينما تختلف بعض المواد الأخرى حسب الجدول.",
      advice: ["لا يمكن الحكم على Na بدون معرفة نوع السماد.", "أرسل نوع السماد أو صورة الملصق.", "ارتفاع الصوديوم قد يزيد مشكلة الملوحة خصوصًا في التربة أو الماء المالح."],
      questions: ["ما نوع السماد المكتوب على الملصق؟"],
    });
  }

  if (containsAny(current, ["ph", "الرقم الهيدروجيني"])) {
    return baseResponse(params, {
      detected_problem: "حد الرقم الهيدروجيني pH",
      summary: "الحد الأقصى للـ pH يختلف حسب نوع المادة. أسمدة العناصر الكبرى pH حتى 7، والأحماض الأمينية حتى 7، والهيوميك والفولفيك قد يصل في الصلب إلى 11 والسائل إلى 8.5 حسب الجدول.",
      advice: ["لا نحكم على pH من الرقم وحده؛ لازم نعرف نوع السماد.", "أرسل نوع المادة: NPK، أحماض أمينية، هيوميك، فولفيك، طحالب، أو غيرها.", "pH يؤثر على الخلط والتوافق وتيسر العناصر."],
      questions: ["ما نوع السماد أو المحسن؟"],
    });
  }

  return baseResponse(params, {
    detected_problem: "اشتراطات وحدود الأسمدة",
    confidence: "medium",
    summary: "في الدليل توجد حدود للملوثات والعناصر مثل Cd وCr VI وHg وNi وPb وAs وSe، إضافة إلى حدود pH وNa وCl حسب نوع السماد.",
    advice: ["أرسل اسم المادة أو صورة شهادة التحليل حتى نحدد الحد الصحيح.", "لا تقارن الرقم بدون معرفة الوحدة: mg/kg أو % أو مستخلص 1%.", "لتسجيل المنتجات يجب الاعتماد على شهادة تحليل معتمدة وملصق مطابق."],
    questions: ["ما العنصر أو الرقم الذي تريد التحقق منه؟"],
  });
}

function buildGeneralElementResponse(params: BuildParams) {
  const current = normalizeArabic(params.message || "");
  const entries: Array<{ terms: string[]; title: string; summary: string; advice: string[] }> = [
    { terms: ["نيتروجين", "nitrogen", "n "], title: "النيتروجين", summary: "النيتروجين مهم للنمو الخضري وزيادة المجموع الورقي، خصوصًا في المراحل الأولى من عمر النبات.", advice: ["زيادته قد تدفع نموًا خضريًا زائدًا على حساب التزهير أو الثمار.", "اصفرار الأوراق القديمة قد يرتبط بنقصه، لكن يلزم تأكيد بالصورة والحالة."] },
    { terms: ["فوسفور", "phosphorus", "p "], title: "الفوسفور", summary: "الفوسفور مهم لتكوين الجذور ونموها، وله دور في مرحلة التزهير وزيادة نسبة الإزهار.", advice: ["لا يخلط مع الكالسيوم والمغنيسيوم والنحاس والكبريت.", "في الأسمدة التي تحتوي يوريا تحذف ادعاءات التزهير حسب ضوابط الملصق."] },
    { terms: ["بوتاسيوم", "potassium", "k "], title: "البوتاسيوم", summary: "البوتاسيوم مهم خاصة في مرحلة الإثمار، ويساعد في تحسين حجم وجودة الثمار والإنتاجية.", advice: ["مهم مع مراحل العقد وتضخم الثمار.", "اختيار مصدر البوتاسيوم يعتمد على الملوحة وطريقة الاستخدام والمحصول."] },
    { terms: ["كالسيوم"], title: "الكالسيوم", summary: "الكالسيوم يساهم في تكوين جدر الخلايا ومهم في مرحلة الإثمار، ويساعد في الوقاية من مشاكل فسيولوجية مثل عفن الطرف الزهري.", advice: ["لا يخلط مع الفوسفور والكبريت.", "يفضل فصله عن كثير من الخلطات غير المؤكدة."] },
    { terms: ["مغنيسيوم", "ماغنيسيوم"], title: "المغنيسيوم", summary: "المغنيسيوم يساعد في النمو الخضري ويساهم في العمليات المرتبطة بالكلوروفيل.", advice: ["قد يرتبط نقصه باصفرار الأوراق القديمة بين العروق.", "سلفات المغنيسيوم لا تخلط مع حمض الفوسفوريك ونترات الكالسيوم."] },
    { terms: ["حديد"], title: "الحديد", summary: "الحديد يساعد في النمو الخضري، وغالبًا تظهر مشاكله كاصفرار في الأوراق الحديثة خصوصًا عند ارتفاع pH.", advice: ["حديد EDTA إذا كان حديدًا فقط يستخدم للرش الورقي فقط حسب ضوابط التسجيل.", "حديد EDDHA يجب أن يحقق نسبة أورثو-أورثو مناسبة عند التسجيل."] },
    { terms: ["بورون"], title: "البورون", summary: "البورون يساعد على استفادة النبات من الكالسيوم وله دور مهم في التلقيح وانتقال السكر داخل النبات.", advice: ["البورون حساس؛ لا ترفع الجرعة عشوائيًا.", "إذا كان أعلى من 2% فمعدل الرش الورقي المرجعي 350–450 جم/1000 لتر/هكتار."] },
  ];

  for (const entry of entries) {
    if (containsAny(current, entry.terms) && containsAny(current, ["فائدة", "فايده", "وش يسوي", "ما دور", "دور", "مهم", "نقص", "زيادة", "عنصر"])) {
      return baseResponse(params, {
        detected_problem: `معلومة عن ${entry.title}`,
        summary: entry.summary,
        advice: entry.advice,
        questions: [],
      });
    }
  }

  return null;
}

function isLikelyFertilizerFollowup(current: string, context: string) {
  const cleanContext = normalizeArabic(customerOnlyContext(context));
  const cleanCurrent = normalizeArabic(current);
  const crop = detectCropType(cleanCurrent);
  const form = detectFertilizerForm(cleanCurrent);
  const method = detectApplicationMethod(cleanCurrent);
  const hasContextDoseCase = (detectNpk(cleanContext) || findFertilizerTypes(cleanContext).length > 0) && (extractAreaM2(cleanContext) || extractTankLiters(cleanContext) || extractTrees(cleanContext));

  if (!hasContextDoseCase) return false;
  if (isMixingQuestionCurrent(cleanCurrent)) return false;

  return Boolean(
    crop ||
    form !== "unknown" ||
    method !== "unknown" ||
    isDoseQuestion(cleanCurrent) ||
    containsAny(cleanCurrent, ["خيار", "طماطم", "بندوره", "بندورة", "بيت محمي", "بيوت محمية", "ذواب", "محبب", "رش ورقي", "ماء الري"])
  );
}

function buildSpecialistHandoff(params: BuildParams) {
  return baseResponse(params, {
    detected_problem: "اختيار منتج سماد مناسب",
    confidence: "medium",
    summary: "أقدر أوضح لك المعدل أو طريقة الاستخدام، لكن اختيار المنتج التجاري الأنسب يحتاج مختص جذرة حتى يطابق الحالة والملصق والمنتجات المتوفرة.",
    advice: [
      "اكتب نوع النبات والمشكلة والمساحة أو ارفع صورة واضحة.",
      "مختص جذرة يحدد الخيار الأنسب بعد معرفة الحالة، بدون ترشيح عشوائي.",
      "لا تخلط أو تستخدم منتجًا قبل التأكد من طريقة الاستخدام على الملصق.",
    ],
    questions: [],
    whatsapp_needed: true,
  });
}

export function buildDeterministicFertilizerResponse(params: BuildParams): FertilizerBotResponse | null {
  const current = normalizeArabic(params.message || "");
  const context = normalizeArabic(customerOnlyContext(params.recentContext || ""));
  const combined = `${context}\n${current}`;

  // 1) سؤال شراء/ترشيح منتج: لا نرشح منتج الآن.
  if (isProductSelectionRequest(current) && isFertilizerInquiry(combined)) {
    return buildSpecialistHandoff(params);
  }

  // 2) حساب مباشر من ملصق: رشاشة × معدل لكل لتر.
  const tankLiters = extractTankLiters(combined);
  const ratePerLiter = extractRatePerLiter(combined);
  if (tankLiters && ratePerLiter && containsAny(combined, ["سماد", "رشاشه", "رشاشة", "ملصق", "جم لكل لتر", "مل لكل لتر", "لكل لتر"])) {
    return buildTankDoseResponse(params, tankLiters, ratePerLiter);
  }

  // 3) سؤال الجرعة الحالي له أولوية مطلقة، والسياق يستخدم فقط لتعبئة الناقص.
  const currentHasNpk = detectNpk(current);
  const currentIsFollowup = isLikelyFertilizerFollowup(current, context);
  const currentDoseOrNpk = currentHasNpk && isDoseQuestion(current);

  if (currentDoseOrNpk || currentIsFollowup) {
    return buildNpkResponse(params, context);
  }

  // 4) الخلط فقط إذا السؤال الحالي سؤال خلط، وليس سؤال جرعة.
  const mixing = buildMixingResponse(params);
  if (mixing) return mixing;

  // 5) تشخيص أعراض واضحة.
  const yellowing = buildYellowingResponse(params);
  if (yellowing) return yellowing;

  // 6) حدود وتسجيل و pH وملوثات.
  const compliance = buildComplianceResponse(params);
  if (compliance) return compliance;

  // 7) معلومات عامة عن العناصر.
  const element = buildGeneralElementResponse(params);
  if (element) return element;

  // 8) أي سماد محدد من الدليل: حساب أو شرح عام.
  const specificTypes = findFertilizerTypes(current);
  if (specificTypes.length) {
    const preferred = specificTypes[0];
    const specific = buildSpecificFertilizerRateResponse(params, preferred, current || combined);
    if (specific) return specific;
  }

  // 9) أي سؤال عام عن الأسمدة: لا نتركه يرد برد آفات عام.
  if (isFertilizerInquiry(combined)) {
    return baseResponse(params, {
      detected_problem: "استفسار عام عن الأسمدة",
      confidence: "medium",
      summary: "أقدر أساعدك في حساب معدلات الأسمدة، قراءة الملصق، قواعد الخلط، أو تشخيص أعراض نقص العناصر. حتى يكون الجواب دقيقًا لازم أعرف نوع السماد وطريقة الاستخدام أو المشكلة الظاهرة.",
      advice: [
        "للحساب: اكتب اسم السماد أو تركيبته + المساحة + هل هو محبب/ذواب/سائل.",
        "للرشاشة: اكتب حجم الرشاشة ومعدل الملصق لكل لتر.",
        "للخلط: اكتب أسماء الأسمدة التي تريد خلطها في نفس الخزان.",
      ],
      questions: ["ما نوع السماد وطريقة الاستخدام أو ما المشكلة التي تريد حلها؟"],
    });
  }

  return null;
}

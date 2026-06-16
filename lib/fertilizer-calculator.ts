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

type ComponentKey =
  | "npk_phosphorus"
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
  | "potassium_nitrate";

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
    .replace(/[\u200f\u200e]/g, "")
    .replace(/[؟?،,؛;:.()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text: string, terms: string[]) {
  const normalized = normalizeArabic(text);
  return terms.some((term) => normalized.includes(normalizeArabic(term)));
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

function extractAreaM2(text: string): number | null {
  const normalized = normalizeArabic(text)
    .replace(/متر مربع/g, "م2")
    .replace(/مترمربع/g, "م2")
    .replace(/م²/g, "م2")
    .replace(/متر مربع/g, "م2");

  const patterns = [
    /(?:مساحه|مساحة|على مساحة|مزرعه مساحة|مزرعة مساحة)\s*(\d+(?:\.\d+)?)/,
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
  const match = normalized.match(/(?:رشاشه|رشاشة|خزان|تنك)\s*(\d+(?:\.\d+)?)\s*(?:لتر|لترات)?|(?:لتر|لترات)\s*(\d+(?:\.\d+)?)/);
  const value = match?.[1] || match?.[2];
  return value ? Number(value) : null;
}

function extractRatePerLiter(text: string): { amount: number; unit: "جم" | "مل" } | null {
  const normalized = normalizeArabic(text);
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(جم|غرام|جرام|مل|ملي|ملل)\s*(?:لكل|\/|في)?\s*(?:1\s*)?لتر/);
  if (!match?.[1] || !match?.[2]) return null;
  const unit = ["مل", "ملي", "ملل"].includes(match[2]) ? "مل" : "جم";
  return { amount: Number(match[1]), unit };
}

function detectNpk(text: string) {
  const normalized = normalizeArabic(text).replace(/[–—_]/g, "-");
  return (
    /20\s*-\s*20\s*-\s*20/.test(normalized) ||
    normalized.includes("npk") ||
    normalized.includes("ان بي كي") ||
    normalized.includes("سماد مركب") ||
    normalized.includes("سماد متوازن") ||
    normalized.includes("العناصر الكبري")
  );
}

function detectCropType(text: string): CropType | null {
  const normalized = normalizeArabic(text);

  if (containsAny(normalized, ["بيت محمي", "بيوت محميه", "صوبه", "صوبة", "محمي"])) return "greenhouse";
  if (containsAny(normalized, ["خيار", "طماطم", "بندوره", "فلفل", "كوسه", "خضار", "خضروات", "باذنجان", "ورقيات", "ملوخيه", "خس", "جرجير"])) return "vegetables";
  if (containsAny(normalized, ["نخيل", "حمضيات", "ليمون", "برتقال", "عنب", "رمان", "فاكهه", "فاكهة", "اشجار", "شجره", "شجرة"])) return "fruit";
  if (containsAny(normalized, ["قمح", "شعير", "ذره", "برسيم", "محاصيل حقليه", "حقلية", "حقل"])) return "field";
  if (containsAny(normalized, ["زينه", "زينة", "ورد", "زهور", "نباتات زينه", "نباتات زينة", "داخلي", "نبات داخلي"])) return "ornamental";

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

const NPK_SOLUBLE_IRRIGATION_RATES: Record<CropType, { min: number; max: number; basis: "kg_per_ha" | "kg_per_1000m2" }> = {
  field: { min: 4, max: 6, basis: "kg_per_ha" },
  vegetables: { min: 5, max: 7, basis: "kg_per_ha" },
  fruit: { min: 6, max: 8, basis: "kg_per_ha" },
  greenhouse: { min: 1, max: 2, basis: "kg_per_1000m2" },
  ornamental: { min: 3, max: 4, basis: "kg_per_ha" },
};

function calculateRateForArea(areaM2: number, rate: { min: number; max: number; basis: "kg_per_ha" | "kg_per_1000m2" }) {
  const gramsPerM2Min = rate.basis === "kg_per_ha" ? (rate.min * 1000) / 10000 : (rate.min * 1000) / 1000;
  const gramsPerM2Max = rate.basis === "kg_per_ha" ? (rate.max * 1000) / 10000 : (rate.max * 1000) / 1000;

  return {
    minGrams: roundSmart(gramsPerM2Min * areaM2),
    maxGrams: roundSmart(gramsPerM2Max * areaM2),
    gramsPerM2Min,
    gramsPerM2Max,
  };
}

function baseResponse(params: BuildParams, patch: Partial<FertilizerBotResponse>): FertilizerBotResponse {
  const language = params.language || "ar";
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
        ? `السلام عليكم، أحتاج مساعدة مختص جذرة في استفسار تسميد. الرسالة: ${params.message}`
        : `Hello, I need a Jothrah specialist for a fertilizer inquiry. Message: ${params.message}`,
    ...patch,
  };
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

function buildNpkAreaResponse(params: BuildParams, areaM2: number, crop: CropType | null) {
  if (!crop) {
    const crops: CropType[] = ["vegetables", "field", "fruit", "ornamental", "greenhouse"];
    const calculated = crops.map((item) => {
      const calc = calculateRateForArea(areaM2, NPK_SOLUBLE_IRRIGATION_RATES[item]);
      return `${cropLabel(item, "ar")}: ${formatNumber(calc.minGrams)}–${formatNumber(calc.maxGrams)} جم`;
    });

    return baseResponse(params, {
      detected_problem: "حساب معدل NPK 20-20-20 حسب المساحة",
      confidence: "medium",
      summary: `لمساحة ${formatNumber(areaM2)} م² من سماد NPK 20-20-20 الذواب مع ماء الري، تختلف الكمية حسب نوع المحصول.`,
      advice: [
        calculated.slice(0, 3).join(" | "),
        calculated.slice(3).join(" | "),
        "إذا كان المحصول خيار أو طماطم أو فلفل فهو غالبًا ضمن محاصيل الخضار.",
      ].filter(Boolean),
      questions: ["ما نوع المحصول؟ وهل الزراعة مكشوفة أو داخل بيت محمي؟"],
    });
  }

  const rate = NPK_SOLUBLE_IRRIGATION_RATES[crop];
  const calc = calculateRateForArea(areaM2, rate);
  const basisText = rate.basis === "kg_per_ha" ? `${rate.min}–${rate.max} كجم / هكتار` : `${rate.min}–${rate.max} كجم / 1000 م²`;

  return baseResponse(params, {
    detected_problem: "حساب معدل NPK 20-20-20 حسب المساحة",
    summary: `لـ ${cropLabel(crop, "ar")} على مساحة ${formatNumber(areaM2)} م²، المعدل الاسترشادي لسماد NPK 20-20-20 الذواب مع ماء الري يكون تقريبًا ${formatNumber(calc.minGrams)}–${formatNumber(calc.maxGrams)} جم.`,
    advice: [
      `المعدل المرجعي: ${basisText}.`,
      `الحساب لمساحة ${formatNumber(areaM2)} م² = ${formatNumber(calc.minGrams)}–${formatNumber(calc.maxGrams)} جم.`,
      "ابدأ بالحد الأقل إذا النبات صغير أو مجهد، والمعدلات تختلف حسب تحليل التربة والمياه ومرحلة النمو.",
    ],
    questions: [],
  });
}

function isDoseQuestion(text: string) {
  const normalized = normalizeArabic(text);
  return containsAny(normalized, ["كم", "جرعه", "جرعة", "معدل", "احط", "اضع", "استخدم", "مساحه", "مساحة", "متر", "لتر"]);
}

function detectComponents(text: string): Set<ComponentKey> {
  const normalized = normalizeArabic(text);
  const out = new Set<ComponentKey>();

  if (detectNpk(normalized) || containsAny(normalized, ["فوسفور", "فوسفوريك", "map", "mkp", "ماب", "ام كيه بي"])) out.add("npk_phosphorus");
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

  return out;
}

function isMixingQuestionCurrent(message: string) {
  const normalized = normalizeArabic(message);
  const components = detectComponents(normalized);
  const hasMixWord = containsAny(normalized, [
    "اخلط", "اخلط", "خلط", "الخلط", "اخلص", "ينفع", "اقدر", "اقدر اخلط", "مع بعض", "سوا", "سوى", "معاه", "معه", "مع ", "معا"
  ]);

  return hasMixWord && components.size >= 2 && !isDoseQuestion(normalized);
}

function buildMixingResponse(params: BuildParams) {
  const current = normalizeArabic(params.message || "");
  const components = detectComponents(current);

  if (!isMixingQuestionCurrent(current)) return null;

  const hasPhosphorus = components.has("npk_phosphorus");
  const hasCalcium = components.has("calcium");
  const hasZincOrMicro = components.has("zinc") || components.has("micronutrients");
  const hasMagnesium = components.has("magnesium");
  const hasCopper = components.has("copper");
  const hasSulfur = components.has("sulfur");
  const hasHumic = components.has("humic");
  const hasAcid = components.has("acid");
  const hasUrea = components.has("urea");
  const hasCalciumNitrate = components.has("calcium_nitrate");

  if (hasCalcium && hasZincOrMicro) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط الكالسيوم مع الزنك أو العناصر الصغرى",
      summary: "لا تخلط الكالسيوم مع الزنك أو العناصر الصغرى في نفس الخزان. الأفضل فصل التطبيق حتى لا يحدث تعارض أو ضعف استفادة.",
      advice: [
        "استخدم الكالسيوم في رية أو رشة مستقلة، والزنك في موعد منفصل.",
        "إذا كان التطبيق ورقيًا، اترك فاصلًا مناسبًا حسب حالة النبات والملصق.",
        "اعمل تجربة خلط صغيرة قبل أي خلط غير مؤكد.",
      ],
      questions: ["هل الاستخدام رش ورقي أو مع ماء الري؟"],
    });
  }

  if (hasPhosphorus && hasCalcium) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط الفوسفور أو NPK مع الكالسيوم",
      summary: "لا تخلط NPK أو أي مركب يحتوي على الفوسفور مع الكالسيوم في نفس الخزان، لأن الفوسفور لا يقبل الخلط مع الكالسيوم وقد يحدث ترسيب أو ضعف في الاستفادة.",
      advice: [
        "أضف كل مركب في وقت منفصل أو خزان مستقل.",
        "يفضل عمل تجربة خلط صغيرة قبل أي خلط للأسمدة.",
        "إذا عندك جدول تسميد محدد، أرسله لمختص جذرة لمراجعته قبل التطبيق.",
      ],
      questions: [],
    });
  }

  if (hasPhosphorus && (hasMagnesium || hasCopper || hasSulfur)) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط مركبات الفوسفور",
      summary: "المركبات التي تحتوي على الفوسفور مثل NPK أو MAP أو MKP لا تقبل الخلط مع المغنيسيوم أو النحاس أو الكبريت.",
      advice: [
        "افصل الإضافة ولا تخلطها في نفس الخزان.",
        "اتبع قابلية الخلط المكتوبة على الملصق.",
        "اعمل تجربة خلط صغيرة إذا كان الخلط ضروريًا.",
      ],
      questions: [],
    });
  }

  if (hasHumic && hasAcid) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط الهيوميك مع الأحماض",
      summary: "الهيوميك لا يقبل الخلط مع الأحماض، ويفضل إضافته منفردًا أو حسب تعليمات الملصق.",
      advice: [
        "افصل الهيوميك عن الأحماض في خزان مستقل.",
        "لا تخلط الهيوميك مع تركيز عالٍ من الكالسيوم.",
        "اعمل تجربة خلط صغيرة قبل أي خلط.",
      ],
      questions: [],
    });
  }

  if (hasUrea && hasCalciumNitrate) {
    return baseResponse(params, {
      detected_problem: "قابلية خلط اليوريا مع نترات الكالسيوم",
      summary: "اليوريا 46% لا تقبل الخلط مع نترات الكالسيوم. الأفضل فصل الإضافة.",
      advice: [
        "استخدم كل سماد في وقت منفصل.",
        "اتبع طريقة الاستخدام المكتوبة على الملصق.",
        "لا ترفع الجرعة لتعويض الفصل بين الإضافات.",
      ],
      questions: [],
    });
  }

  return baseResponse(params, {
    detected_problem: "قابلية خلط الأسمدة",
    confidence: "medium",
    summary: "قابلية الخلط تختلف حسب تركيب السماد وتركيزه ودرجة الحموضة. لا تعتمد على الخلط إلا إذا كان الملصق يسمح بذلك.",
    advice: [
      "اعمل تجربة خلط صغيرة قبل الخلط في الخزان.",
      "افصل المركبات غير المؤكدة في إضافات مستقلة.",
      "أرسل صورة الملصق إذا رغبت بمراجعة الخلط بدقة.",
    ],
    questions: ["ما أسماء الأسمدة كاملة أو صورة ملصقاتها؟"],
  });
}

function isLikelyFertilizerFollowup(current: string, context: string) {
  const crop = detectCropType(current);
  return Boolean(crop && detectNpk(context) && extractAreaM2(context));
}

export function buildDeterministicFertilizerResponse(params: BuildParams): FertilizerBotResponse | null {
  const current = normalizeArabic(params.message || "");
  const context = normalizeArabic(params.recentContext || "");
  const combined = `${context}\n${current}`;

  const tankLiters = extractTankLiters(combined);
  const ratePerLiter = extractRatePerLiter(combined);
  if (tankLiters && ratePerLiter && containsAny(combined, ["سماد", "رشاشه", "رشاشة", "ملصق", "جم لكل لتر", "مل لكل لتر"])) {
    return buildTankDoseResponse(params, tankLiters, ratePerLiter);
  }

  const currentIsNpkDose = (detectNpk(current) || (detectNpk(context) && isLikelyFertilizerFollowup(current, context))) && isDoseQuestion(combined);

  // مهم: أسئلة الجرعة الحالية لها أولوية على سياق قديم عن الخلط.
  if (currentIsNpkDose) {
    const areaM2 = extractAreaM2(current) || extractAreaM2(context) || extractAreaM2(combined);
    const crop = detectCropType(current) || detectCropType(context);

    if (areaM2) {
      return buildNpkAreaResponse(params, areaM2, crop);
    }

    return baseResponse(params, {
      detected_problem: "حساب معدل NPK 20-20-20",
      confidence: "medium",
      summary: "أقدر أحسب كمية NPK بدقة، لكن أحتاج المساحة بالمتر المربع وطريقة الاستخدام: مع ماء الري أو رش ورقي.",
      advice: [
        "اكتب المساحة مثل: 50 م².",
        "حدد هل الزراعة مكشوفة أو بيت محمي.",
        "اكتب نوع المحصول مثل خيار، طماطم، نخيل، زينة.",
      ],
      questions: ["كم المساحة بالمتر المربع؟ وما نوع المحصول؟"],
    });
  }

  const mixing = buildMixingResponse(params);
  if (mixing) return mixing;

  return null;
}

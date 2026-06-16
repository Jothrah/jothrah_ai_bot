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

function formatNumberAr(value: number) {
  return String(roundSmart(value));
}

function extractAreaM2(text: string): number | null {
  const normalized = normalizeArabic(text)
    .replace(/متر مربع/g, "م2")
    .replace(/مترمربع/g, "م2")
    .replace(/م²/g, "م2");

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
    normalized.includes("العناصر الكبري")
  );
}

function detectCropType(text: string): "vegetables" | "field" | "fruit" | "greenhouse" | "ornamental" | null {
  const normalized = normalizeArabic(text);

  if (containsAny(normalized, ["بيت محمي", "بيوت محميه", "صوبه", "صوبة", "محمي"])) return "greenhouse";
  if (containsAny(normalized, ["خيار", "طماطم", "بندوره", "فلفل", "كوسه", "خضار", "خضروات", "باذنجان", "ورقيات"])) return "vegetables";
  if (containsAny(normalized, ["نخيل", "حمضيات", "ليمون", "برتقال", "عنب", "رمان", "فاكهه", "فاكهة", "اشجار", "شجره", "شجرة"])) return "fruit";
  if (containsAny(normalized, ["قمح", "شعير", "ذره", "برسيم", "محاصيل حقليه", "حقلية"])) return "field";
  if (containsAny(normalized, ["زينه", "زينة", "ورد", "زهور", "نباتات زينه", "نباتات زينة"])) return "ornamental";

  return null;
}

function cropLabel(crop: ReturnType<typeof detectCropType>, language: "ar" | "en") {
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

const NPK_SOLUBLE_IRRIGATION_RATES: Record<string, { min: number; max: number; basis: "kg_per_ha" | "kg_per_1000m2" }> = {
  field: { min: 4, max: 6, basis: "kg_per_ha" },
  vegetables: { min: 5, max: 7, basis: "kg_per_ha" },
  fruit: { min: 6, max: 8, basis: "kg_per_ha" },
  greenhouse: { min: 1, max: 2, basis: "kg_per_1000m2" },
  ornamental: { min: 3, max: 4, basis: "kg_per_ha" },
};

function calculateRateForArea(areaM2: number, rate: { min: number; max: number; basis: "kg_per_ha" | "kg_per_1000m2" }) {
  const gramsPerM2Min = rate.basis === "kg_per_ha" ? rate.min * 1000 / 10000 : rate.min * 1000 / 1000;
  const gramsPerM2Max = rate.basis === "kg_per_ha" ? rate.max * 1000 / 10000 : rate.max * 1000 / 1000;

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
  if (params.language === "en") {
    return baseResponse(params, {
      detected_problem: "Fertilizer dose calculation",
      summary: `For a ${tankLiters} L sprayer at ${rate.amount} ${rate.unit}/L, use about ${total} ${rate.unit} in total.`,
      advice: [
        `Calculation: ${tankLiters} × ${rate.amount} = ${total} ${rate.unit}.`,
        "Use the label rate and do not exceed it.",
        "Avoid spraying at noon or on stressed plants.",
      ],
      questions: [],
    });
  }

  return baseResponse(params, {
    detected_problem: "حساب جرعة سماد حسب حجم الرشاشة",
    summary: `إذا كان المكتوب على الملصق ${formatNumberAr(rate.amount)} ${rate.unit} لكل لتر، ورشاشتك ${formatNumberAr(tankLiters)} لتر، فالكمية الإجمالية تكون تقريبًا ${formatNumberAr(total)} ${rate.unit}.`,
    advice: [
      `الحساب: ${formatNumberAr(tankLiters)} × ${formatNumberAr(rate.amount)} = ${formatNumberAr(total)} ${rate.unit}.`,
      "التزم بمعدل الملصق ولا ترفع الجرعة من نفسك.",
      "تجنب الرش وقت الظهيرة أو على نبات مجهد.",
    ],
    questions: [],
  });
}

function buildNpkAreaResponse(params: BuildParams, areaM2: number, crop: ReturnType<typeof detectCropType>) {
  if (!crop) {
    const crops = ["vegetables", "field", "fruit", "ornamental", "greenhouse"] as const;
    const calculated = crops.map((item) => {
      const calc = calculateRateForArea(areaM2, NPK_SOLUBLE_IRRIGATION_RATES[item]);
      return `${cropLabel(item, "ar")}: ${formatNumberAr(calc.minGrams)}–${formatNumberAr(calc.maxGrams)} جم`;
    });

    return baseResponse(params, {
      detected_problem: "حساب معدل NPK 20-20-20 حسب المساحة",
      confidence: "medium",
      summary: `لمساحة ${formatNumberAr(areaM2)} م² من سماد NPK الذواب مع ماء الري، تختلف الكمية حسب نوع المحصول.`,
      advice: [
        calculated.slice(0, 3).join(" | "),
        calculated.slice(3).join(" | "),
        "إذا كان المحصول خيار أو طماطم أو فلفل فهو غالبًا ضمن محاصيل الخضار.",
      ].filter(Boolean),
      questions: ["ما نوع المحصول؟ وهل هو بيت محمي أو زراعة مكشوفة؟"],
    });
  }

  const rate = NPK_SOLUBLE_IRRIGATION_RATES[crop];
  const calc = calculateRateForArea(areaM2, rate);

  if (params.language === "en") {
    return baseResponse(params, {
      detected_problem: "NPK 20-20-20 area dose calculation",
      summary: `For ${cropLabel(crop, "en")} over ${areaM2} m², the indicative soluble NPK rate with irrigation is about ${calc.minGrams}–${calc.maxGrams} g.`,
      advice: [
        rate.basis === "kg_per_ha"
          ? `Reference rate: ${rate.min}–${rate.max} kg/ha.`
          : `Reference rate: ${rate.min}–${rate.max} kg/1000 m².`,
        `Calculation for ${areaM2} m² = ${calc.minGrams}–${calc.maxGrams} g.`,
        "Start with the lower rate if the plants are young or stressed.",
      ],
      questions: [],
    });
  }

  const basisText = rate.basis === "kg_per_ha" ? `${rate.min}–${rate.max} كجم / هكتار` : `${rate.min}–${rate.max} كجم / 1000 م²`;

  return baseResponse(params, {
    detected_problem: "حساب معدل NPK 20-20-20 حسب المساحة",
    summary: `لـ ${cropLabel(crop, "ar")} على مساحة ${formatNumberAr(areaM2)} م²، المعدل الاسترشادي لسماد NPK الذواب مع ماء الري يكون تقريبًا ${formatNumberAr(calc.minGrams)}–${formatNumberAr(calc.maxGrams)} جم.`,
    advice: [
      `المعدل المرجعي: ${basisText}.`,
      `الحساب لمساحة ${formatNumberAr(areaM2)} م² = ${formatNumberAr(calc.minGrams)}–${formatNumberAr(calc.maxGrams)} جم.`,
      "ابدأ بالحد الأقل إذا النبات صغير أو مجهد، والمعدلات تختلف حسب تحليل التربة والمياه ومرحلة النمو.",
    ],
    questions: [],
  });
}

function buildMixingResponse(params: BuildParams) {
  const combined = normalizeArabic(`${params.recentContext || ""} ${params.message}`);
  const hasNpkOrPhosphorus = containsAny(combined, ["npk", "20-20-20", "فوسفور", "فوسفوريك", "map", "mkp"]);
  const hasCalcium = containsAny(combined, ["كالسيوم", "نترات الكالسيوم", "نترات كالسيوم"]);

  if (!hasNpkOrPhosphorus || !hasCalcium) return null;

  return baseResponse(params, {
    detected_problem: "قابلية خلط الأسمدة",
    summary: "لا تخلط NPK أو أي مركب يحتوي على الفوسفور مع الكالسيوم، لأن الفوسفور لا يقبل الخلط مع الكالسيوم وقد يحدث ترسيب أو ضعف في الاستفادة.",
    advice: [
      "أضف كل مركب في وقت منفصل أو خزان مستقل.",
      "يفضل عمل تجربة خلط صغيرة قبل أي خلط للأسمدة.",
      "إذا عندك جدول تسميد محدد، أرسله لمختص جذرة لمراجعته قبل التطبيق.",
    ],
    questions: [],
  });
}

export function buildDeterministicFertilizerResponse(params: BuildParams): FertilizerBotResponse | null {
  const combined = `${params.recentContext || ""}\n${params.message || ""}`;
  const normalizedCombined = normalizeArabic(combined);
  const normalizedCurrent = normalizeArabic(params.message || "");

  const tankLiters = extractTankLiters(normalizedCombined);
  const ratePerLiter = extractRatePerLiter(normalizedCombined);
  if (tankLiters && ratePerLiter && containsAny(normalizedCombined, ["سماد", "رشاشه", "رشاشة", "ملصق", "جم لكل لتر", "مل لكل لتر"])) {
    return buildTankDoseResponse(params, tankLiters, ratePerLiter);
  }

  const mixing = buildMixingResponse(params);
  if (mixing) return mixing;

  const isNpkQuestion = detectNpk(normalizedCombined) || (/20\s*-\s*20\s*-\s*20/.test(normalizedCombined));
  const asksDose = containsAny(normalizedCombined, ["كم", "جرعه", "جرعة", "معدل", "احط", "اضع", "مساحه", "مساحة", "متر"]);

  if (isNpkQuestion && asksDose) {
    const areaM2 = extractAreaM2(normalizedCurrent) || extractAreaM2(normalizedCombined);
    const crop = detectCropType(normalizedCurrent) || detectCropType(normalizedCombined);

    if (areaM2) {
      return buildNpkAreaResponse(params, areaM2, crop);
    }

    return baseResponse(params, {
      detected_problem: "حساب معدل NPK 20-20-20",
      confidence: "medium",
      summary: "أقدر أحسب لك كمية NPK بدقة، لكن أحتاج المساحة بالمتر المربع وطريقة الاستخدام: مع ماء الري أو رش ورقي.",
      advice: [
        "اكتب المساحة مثل: 50 م².",
        "حدد هل الزراعة مكشوفة أو بيت محمي.",
        "اكتب نوع المحصول مثل خيار، طماطم، نخيل، زينة.",
      ],
      questions: ["كم المساحة بالمتر المربع؟ وما نوع المحصول؟"],
    });
  }

  return null;
}

import { promises as fs } from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { jothrahSystemPrompt } from "@/lib/jothrah-system-prompt";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import { detectLanguage, matchCategories } from "@/lib/matcher";
import { needsWhatsapp } from "@/lib/safety";

export const runtime = "nodejs";

type ChatCategory = {
  title: string;
  url: string;
};

type ChatResponse = {
  language: "ar" | "en";
  summary: string;
  advice: string[];
  questions: string[];
  categories: ChatCategory[];
  whatsapp_needed: boolean;
  whatsapp_message: string;
};

type Correction = { wrong: string; right: string };
type AliasItem = { key: string; title?: string; aliases: string[] };
type Material = AliasItem & { topics: string[] };
type CompatibilityRule = {
  id: string;
  required_topics: string[];
  severity: string;
  rule: string;
};
type RateRule = {
  id: string;
  family_topic: string;
  form?: string;
  application?: string;
  crop?: string;
  label_ar: string;
  rate: {
    min: number;
    max: number;
    unit: string;
    per_area_m2?: number;
    per_area_ha?: number;
    per_water_liter?: number;
  };
};
type PhLimit = { topic: string; title: string; solid?: number; liquid?: number };

type FertilizerKnowledge = {
  version: string;
  title_ar: string;
  source_note_ar?: string;
  recommended_categories?: ChatCategory[];
  global_rules_ar?: string[];
  term_corrections_ar?: Correction[];
  intent_keywords_ar?: Record<string, string[]>;
  forms_ar?: AliasItem[];
  applications_ar?: AliasItem[];
  crops_ar?: AliasItem[];
  materials_ar?: Material[];
  compatibility_rules_ar?: CompatibilityRule[];
  usage_rates_ar?: RateRule[];
  ph_limits_ar?: PhLimit[];
  label_requirements_ar?: string[];
  storage_ar?: string[];
};

type FertilizerAnalysis = {
  isFertilizer: boolean;
  correctedMessage: string;
  correctedChanged: boolean;
  intents: string[];
  materials: Material[];
  topics: string[];
  form?: AliasItem;
  application?: AliasItem;
  crop?: AliasItem;
  areaM2?: number;
  waterLiter?: number;
  npkFormula?: string;
  compatibilityRules: CompatibilityRule[];
  rateRule?: RateRule;
  phLimits: PhLimit[];
  missingForUsage: string[];
};

function corsHeaders() {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://jothrah.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({ apiKey });
}

const responseSchema = {
  name: "jothrah_chat_response",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      language: { type: "string", enum: ["ar", "en"] },
      summary: { type: "string" },
      advice: {
        type: "array",
        items: { type: "string" },
        maxItems: 3
      },
      questions: {
        type: "array",
        items: { type: "string" },
        maxItems: 2
      },
      categories: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            url: { type: "string" }
          },
          required: ["title", "url"]
        },
        maxItems: 3
      },
      whatsapp_needed: { type: "boolean" },
      whatsapp_message: { type: "string" }
    },
    required: [
      "language",
      "summary",
      "advice",
      "questions",
      "categories",
      "whatsapp_needed",
      "whatsapp_message"
    ]
  },
  strict: true
} as const;

function normalizeArabic(input: string) {
  return input
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[،؛؟]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function includesNormalized(text: string, pattern: string) {
  return text.includes(normalizeArabic(pattern));
}

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => includesNormalized(text, pattern));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeNumber(value: string) {
  const num = Number(value.replace(",", "."));
  return Number.isFinite(num) ? num : undefined;
}

async function loadFertilizerKnowledge() {
  try {
    const filePath = path.join(
      process.cwd(),
      "data",
      "knowledge",
      "nutrition",
      "fertilizer-core.json"
    );
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as FertilizerKnowledge;
  } catch (error) {
    console.error("Failed to load fertilizer-core knowledge", error);
    return null;
  }
}

function applyTermCorrections(message: string, knowledge: FertilizerKnowledge | null) {
  let corrected = message;

  for (const correction of knowledge?.term_corrections_ar || []) {
    const escaped = escapeRegExp(correction.wrong);
    corrected = corrected.replace(new RegExp(escaped, "gi"), correction.right);
  }

  // توحيد صيغة NPK المكتوبة بمسافات مثل 15 15 15 إلى 15-15-15
  corrected = corrected.replace(/\b(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\b/g, "$1-$2-$3");

  return corrected;
}

function detectNpkFormula(message: string) {
  const match = message.match(/\b(\d{1,2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{1,2})\b/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

function detectAreaM2(message: string) {
  const text = normalizeArabic(message);
  const m2Match = text.match(/(\d+(?:[\.,]\d+)?)\s*(?:متر|م٢|م2|m2|متر مربع|م²)/i);
  if (m2Match) return safeNumber(m2Match[1]);

  const greenhouseAreaMatch = text.match(/مساحه\s*(\d+(?:[\.,]\d+)?)/i);
  if (greenhouseAreaMatch) return safeNumber(greenhouseAreaMatch[1]);

  return undefined;
}

function detectWaterLiter(message: string) {
  const text = normalizeArabic(message);
  const match = text.match(/(\d+(?:[\.,]\d+)?)\s*(?:لتر|ليتر|liter|litre|l)\b/i);
  return match ? safeNumber(match[1]) : undefined;
}

function detectAliasItem<T extends AliasItem>(message: string, items: T[] = []) {
  const text = normalizeArabic(message);
  return items.find((item) => includesAny(text, item.aliases));
}

function detectMaterials(message: string, knowledge: FertilizerKnowledge | null) {
  const text = normalizeArabic(message);
  const materials = knowledge?.materials_ar || [];

  return materials.filter((material) => includesAny(text, material.aliases));
}

function detectIntents(message: string, knowledge: FertilizerKnowledge | null) {
  const text = normalizeArabic(message);
  const intents: string[] = [];
  const keywordMap = knowledge?.intent_keywords_ar || {};

  for (const [intent, keywords] of Object.entries(keywordMap)) {
    if (includesAny(text, keywords)) intents.push(intent);
  }

  return unique(intents);
}

function isFertilizerQuestion(message: string, knowledge: FertilizerKnowledge | null) {
  const text = normalizeArabic(message);
  const intents = detectIntents(message, knowledge);
  const materials = detectMaterials(message, knowledge);
  const npkFormula = detectNpkFormula(message);

  return (
    intents.length > 0 ||
    materials.length > 0 ||
    Boolean(npkFormula) ||
    includesAny(text, [
      "سماد",
      "اسمده",
      "تسميد",
      "محسن تربه",
      "عناصر صغري",
      "عناصر كبري",
      "ذواب",
      "محبب",
      "معلق",
      "معجون"
    ])
  );
}

function analyzeFertilizerQuestion(
  originalMessage: string,
  knowledge: FertilizerKnowledge | null
): FertilizerAnalysis {
  const correctedMessage = applyTermCorrections(originalMessage, knowledge);
  const intents = detectIntents(correctedMessage, knowledge);
  const materials = detectMaterials(correctedMessage, knowledge);
  const npkFormula = detectNpkFormula(correctedMessage);

  const topics = unique([
    ...materials.flatMap((m) => m.topics || []),
    ...(npkFormula ? ["npk", "macro_elements"] : [])
  ]);

  const form = detectAliasItem(correctedMessage, knowledge?.forms_ar || []);
  const application = detectAliasItem(correctedMessage, knowledge?.applications_ar || []);
  const crop = detectAliasItem(correctedMessage, knowledge?.crops_ar || []);
  const areaM2 = detectAreaM2(correctedMessage);
  const waterLiter = detectWaterLiter(correctedMessage);

  const compatibilityRules = (knowledge?.compatibility_rules_ar || []).filter((rule) =>
    rule.required_topics.every((topic) => topics.includes(topic))
  );

  const phLimits = (knowledge?.ph_limits_ar || []).filter((limit) => topics.includes(limit.topic));

  const rateRule = (knowledge?.usage_rates_ar || []).find((rule) => {
    if (!topics.includes(rule.family_topic)) return false;
    if (rule.form && form?.key !== rule.form) return false;
    if (rule.application && application?.key !== rule.application) return false;
    if (rule.crop && crop?.key !== rule.crop && application?.key !== rule.crop) return false;
    return true;
  });

  const asksForUsage = intents.includes("usage_rate");
  const missingForUsage: string[] = [];

  if (asksForUsage) {
    if (!form) missingForUsage.push("نوع السماد: ذواب، سائل، محبب، معلق، أو معجون");
    if (!application) missingForUsage.push("طريقة الاستخدام: ماء الري، رش ورقي، نثر، أو حول النبات");
    if (!areaM2 && !waterLiter) missingForUsage.push("المساحة أو حجم الخزان أو عدد الأشجار");
    if (!crop) missingForUsage.push("نوع النبات أو المحصول ومرحلة النمو");
  }

  return {
    isFertilizer: isFertilizerQuestion(originalMessage, knowledge),
    correctedMessage,
    correctedChanged: correctedMessage.trim() !== originalMessage.trim(),
    intents,
    materials,
    topics,
    form,
    application,
    crop,
    areaM2,
    waterLiter,
    npkFormula,
    compatibilityRules,
    rateRule,
    phLimits,
    missingForUsage
  };
}

function defaultFertilizerCategories(
  knowledge: FertilizerKnowledge | null,
  matchedCategories: ChatCategory[]
) {
  if (knowledge?.recommended_categories?.length) {
    return knowledge.recommended_categories.slice(0, 2);
  }

  if (matchedCategories.length) return matchedCategories.slice(0, 2);

  return [{ title: "الأسمدة والتربة", url: "https://jothrah.com/" }];
}

function fertilizerWhatsappMessage(message: string) {
  return `السلام عليكم، أحتاج مساعدة في سؤال أسمدة: ${message}`;
}

function correctionPrefix(analysis: FertilizerAnalysis) {
  return analysis.correctedChanged ? `تصحيح المقصود: ${analysis.correctedMessage}\n` : "";
}

function materialNames(analysis: FertilizerAnalysis) {
  const names = analysis.materials.map((m) => m.title || m.key);
  if (analysis.npkFormula && !names.includes(analysis.npkFormula)) names.unshift(analysis.npkFormula);
  return unique(names);
}

function calculateAreaRate(rateRule: RateRule, areaM2: number) {
  const per = rateRule.rate.per_area_m2;
  if (!per) return null;

  const min = (rateRule.rate.min * areaM2) / per;
  const max = (rateRule.rate.max * areaM2) / per;
  const format = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  };

  return `${format(min)}${min !== max ? `-${format(max)}` : ""} ${rateRule.rate.unit}`;
}

function buildDynamicFertilizerGuardResponse(
  originalMessage: string,
  analysis: FertilizerAnalysis,
  knowledge: FertilizerKnowledge | null,
  matchedCategories: ChatCategory[]
): ChatResponse | null {
  const categories = defaultFertilizerCategories(knowledge, matchedCategories);
  const prefix = correctionPrefix(analysis);
  const names = materialNames(analysis);

  // 1) أسئلة الخلط: تعالج أي تركيبة بناءً على قواعد الموضوعات، وليس مثالًا محفوظًا.
  if (analysis.intents.includes("mixing")) {
    const foundRules = analysis.compatibilityRules.slice(0, 3);
    const baseSubject = names.length ? names.join(" + ") : "الأسمدة المذكورة";

    const advice = foundRules.length
      ? foundRules.map((rule) => rule.rule).slice(0, 2)
      : [
          "لا يصح إعطاء حكم خلط نهائي بدون معرفة أسماء المنتجات وصيغتها ومصدر العنصر.",
          "إذا لم يسمح الملصق بالخلط صراحة، فالفصل بين الإضافات أو الخزانات أكثر أمانًا."
        ];

    advice.push("اعمل تجربة خلط صغيرة في وعاء شفاف قبل أي خلط، ولا تعتمد الخلط إذا ظهر ترسب أو تعكر أو حرارة أو رغوة.");

    return {
      language: "ar",
      summary:
        `${prefix}` +
        `سؤالك عن خلط ${baseSubject}. الحكم يعتمد على صورة كل سماد وملصق المنتج وطريقة الاستخدام؛ لذلك لا أعطي موافقة خلط نهائية بدون هذه البيانات.`,
      advice: advice.slice(0, 3),
      questions: [
        "ما اسم كل منتج وصيغته: ذواب، سائل، محبب، معلق؟",
        "هل الخلط للرش الورقي أم مع ماء الري؟"
      ],
      categories,
      whatsapp_needed: foundRules.some((r) => ["avoid", "avoid_or_separate", "avoid_general_mixing"].includes(r.severity)),
      whatsapp_message: fertilizerWhatsappMessage(analysis.correctedMessage || originalMessage)
    };
  }

  // 2) أسئلة pH والحدود: تعالج أي مادة موجودة في جدول pH.
  if (analysis.intents.includes("ph_limit")) {
    const limits = analysis.phLimits.slice(0, 2);

    if (limits.length) {
      const lines = limits.map((limit) => {
        if (analysis.form?.key === "liquid" && typeof limit.liquid === "number") {
          return `${limit.title}: الحد الأعلى للسائل pH ${limit.liquid}.`;
        }
        if (
          ["water_soluble", "granular"].includes(analysis.form?.key || "") &&
          typeof limit.solid === "number"
        ) {
          return `${limit.title}: الحد الأعلى للصلب pH ${limit.solid}.`;
        }
        return `${limit.title}: الحد الأعلى للصلب pH ${limit.solid ?? "غير محدد"}، وللسائل pH ${limit.liquid ?? "غير محدد"}.`;
      });

      return {
        language: "ar",
        summary:
          `${prefix}` +
          `تقصد غالبًا pH أو الرقم الهيدروجيني. حسب نوع المادة وصورتها: ${lines.join(" ")}`,
        advice: [
          "هذا الحد يخص المنتج أو مستخلصه حسب بيانات الملصق، وليس بالضرورة pH ماء الري بعد التخفيف.",
          "إذا كان المنتج محملًا على عناصر أخرى أو هيومات بوتاسيوم، راجع التحليل والملصق قبل الحكم.",
          "في الأسمدة المركبة NPK المفترض ألا يزيد pH عن 7 حسب المرجع العام."
        ],
        questions: [
          "هل المنتج صلب/ذواب أم سائل؟",
          "هل تقصد pH المنتج نفسه أم pH محلول الرش/الري؟"
        ],
        categories,
        whatsapp_needed: false,
        whatsapp_message: fertilizerWhatsappMessage(analysis.correctedMessage || originalMessage)
      };
    }
  }

  // 3) أسئلة الاستخدام: إذا البيانات ناقصة، اسأل بدل التخمين.
  if (analysis.intents.includes("usage_rate") && analysis.missingForUsage.length) {
    return {
      language: "ar",
      summary:
        `${prefix}` +
        "أقدر أساعدك في طريقة الاستخدام، لكن لا يصح أعطي معدل نهائي قبل اكتمال البيانات؛ لأن الذواب والسائل والمحبب تختلف معدلاتها بالكامل.",
      advice: [
        "صوّر ملصق العبوة أو اكتب الاسم والتركيبة مثل NPK أو نترات كالسيوم أو هيوميك.",
        `البيانات الناقصة: ${analysis.missingForUsage.slice(0, 3).join("، ")}.`,
        "أي معدل أذكره سيكون استرشاديًا ويختلف حسب تحليل التربة والمياه ونوع النبات ومرحلة النمو."
      ],
      questions: [
        "هل السماد ذواب/سائل أم محبب للتربة؟",
        "كم المساحة أو حجم الخزان، وما نوع النبات؟"
      ],
      categories,
      whatsapp_needed: false,
      whatsapp_message: fertilizerWhatsappMessage(analysis.correctedMessage || originalMessage)
    };
  }

  // 4) إذا اكتملت بيانات كافية وموجود معدل معروف، احسب بدل ما تترك النموذج يخمن.
  if (analysis.intents.includes("usage_rate") && analysis.rateRule) {
    const amount = analysis.areaM2 ? calculateAreaRate(analysis.rateRule, analysis.areaM2) : null;
    const basis = analysis.areaM2
      ? `لمساحة ${analysis.areaM2} م²`
      : analysis.waterLiter
        ? `لخزان ${analysis.waterLiter} لتر`
        : "حسب المرجع المتاح";

    const rateText = amount
      ? `${amount} ${basis}`
      : analysis.rateRule.rate.per_water_liter
        ? `${analysis.rateRule.rate.min}-${analysis.rateRule.rate.max} ${analysis.rateRule.rate.unit} / ${analysis.rateRule.rate.per_water_liter} لتر`
        : `${analysis.rateRule.rate.min}-${analysis.rateRule.rate.max} ${analysis.rateRule.rate.unit}`;

    return {
      language: "ar",
      summary:
        `${prefix}` +
        `حسب البيانات التي ذكرتها، المرجع الأقرب هو: ${analysis.rateRule.label_ar}. المعدل الاسترشادي المحسوب: ${rateText}.`,
      advice: [
        "هذا رقم استرشادي وليس بديلًا عن ملصق المنتج أو تحليل التربة والمياه.",
        "وزّع السماد بالتساوي، ولا ترفعه عن الحد الأعلى بدون سبب فني واضح.",
        "إذا كان المنتج غير ذواب بالكامل فلا تذوبه في الخزان إلا إذا ذكر الملصق ذلك صراحة."
      ],
      questions: [
        "ما نوع المحصول ومرحلة النمو؟",
        "هل لديك تحليل تربة أو ماء؟"
      ],
      categories,
      whatsapp_needed: false,
      whatsapp_message: fertilizerWhatsappMessage(analysis.correctedMessage || originalMessage)
    };
  }

  return null;
}

function buildFertilizerKnowledgePrompt(
  knowledge: FertilizerKnowledge | null,
  analysis: FertilizerAnalysis,
  historyText: string
) {
  if (!knowledge) {
    return "Fertilizer knowledge file was not loaded. Ask clarifying questions and do not invent fertilizer rates or mixing rules.";
  }

  const compactKnowledge = {
    source_note_ar: knowledge.source_note_ar,
    global_rules_ar: knowledge.global_rules_ar,
    detected_analysis: {
      correctedMessage: analysis.correctedMessage,
      intents: analysis.intents,
      materials: materialNames(analysis),
      topics: analysis.topics,
      form: analysis.form?.title || analysis.form?.key,
      application: analysis.application?.title || analysis.application?.key,
      crop: analysis.crop?.title || analysis.crop?.key,
      areaM2: analysis.areaM2,
      waterLiter: analysis.waterLiter,
      npkFormula: analysis.npkFormula,
      compatibilityRules: analysis.compatibilityRules.map((r) => r.rule),
      phLimits: analysis.phLimits,
      matchedRate: analysis.rateRule
    },
    usage_rates_ar: knowledge.usage_rates_ar,
    compatibility_rules_ar: knowledge.compatibility_rules_ar,
    ph_limits_ar: knowledge.ph_limits_ar,
    label_requirements_ar: knowledge.label_requirements_ar,
    storage_ar: knowledge.storage_ar
  };

  return `
FERTILIZER ENGINE CONTEXT FOR JOTHRAH CHAT:
${JSON.stringify(compactKnowledge, null, 2)}

RECENT CHAT HISTORY IF PROVIDED:
${historyText || "No history provided by client."}

STRICT RESPONSE RULES:
- Treat user examples as intent patterns, not exact phrases.
- Correct obvious Arabic fertilizer typos naturally: نترت/نترات، كلسيوم/كالسيوم، بي اتش/pH، هيومك/هيوميك.
- If the question lacks form/application/area/crop, ask clarifying questions before giving a final rate.
- For mixing, do not say a mixture is allowed unless the product label allows it. If uncertain, recommend separation and ask for labels.
- Use ONLY rates and pH limits available in the knowledge context.
- Say any fertilizer rate is استرشادي and depends on soil/water analysis, crop, variety, and growth stage.
- Keep response short and practical: summary + up to 3 advice + up to 2 questions.
- Do not answer pest-control pesticide questions using fertilizer rules.
`;
}

function compactHistory(rawHistory: unknown) {
  if (!Array.isArray(rawHistory)) return "";

  return rawHistory
    .slice(-8)
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const role = "role" in item ? String((item as { role?: unknown }).role || "") : "";
      const content = "content" in item ? String((item as { content?: unknown }).content || "") : "";
      if (!content.trim()) return "";
      return `${role || "message"}: ${content.slice(0, 800)}`;
    })
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = String(body.message || "").trim();
    const historyText = compactHistory(body.history);

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const language = detectLanguage(message) as "ar" | "en";
    const matchedCategories = matchCategories(message, language) as ChatCategory[];
    const forceWhatsapp = needsWhatsapp(message);

    const fertilizerKnowledge = await loadFertilizerKnowledge();
    const fertilizerQuestion = isFertilizerQuestion(`${historyText}\n${message}`, fertilizerKnowledge);
    const fertilizerAnalysis = analyzeFertilizerQuestion(
      historyText ? `${historyText}\n${message}` : message,
      fertilizerKnowledge
    );

    if (fertilizerQuestion && language === "ar") {
      const guarded = buildDynamicFertilizerGuardResponse(
        message,
        fertilizerAnalysis,
        fertilizerKnowledge,
        matchedCategories
      );

      if (guarded) {
        const whatsappMessage = guarded.whatsapp_message || fertilizerWhatsappMessage(fertilizerAnalysis.correctedMessage);
        return NextResponse.json(
          {
            ...guarded,
            whatsapp_needed: Boolean(guarded.whatsapp_needed || forceWhatsapp),
            whatsapp_url: buildWhatsappUrl(whatsappMessage)
          },
          { headers: corsHeaders() }
        );
      }
    }

    const client = getOpenAIClient();

    const systemMessages = [
      {
        role: "system" as const,
        content: jothrahSystemPrompt
      },
      {
        role: "system" as const,
        content: `
Matched categories:
${JSON.stringify(matchedCategories, null, 2)}

Force WhatsApp:
${forceWhatsapp}
`
      }
    ];

    if (fertilizerQuestion) {
      systemMessages.push({
        role: "system" as const,
        content: buildFertilizerKnowledgePrompt(fertilizerKnowledge, fertilizerAnalysis, historyText)
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        ...systemMessages,
        {
          role: "user",
          content: fertilizerQuestion ? fertilizerAnalysis.correctedMessage : message
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: responseSchema
      }
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const data = JSON.parse(raw) as ChatResponse;

    const effectiveMessage = fertilizerQuestion ? fertilizerAnalysis.correctedMessage : message;
    const whatsappMessage =
      data.whatsapp_message ||
      (language === "ar"
        ? `السلام عليكم، أحتاج مساعدة في: ${effectiveMessage}`
        : `Hello, I need help with: ${effectiveMessage}`);

    const fallbackCategories = fertilizerQuestion
      ? defaultFertilizerCategories(fertilizerKnowledge, matchedCategories)
      : matchedCategories;

    return NextResponse.json(
      {
        ...data,
        categories: data.categories?.length ? data.categories : fallbackCategories,
        whatsapp_needed: Boolean(data.whatsapp_needed || forceWhatsapp),
        whatsapp_url: buildWhatsappUrl(whatsappMessage)
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

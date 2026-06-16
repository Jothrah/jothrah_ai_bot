import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { jothrahSystemPrompt } from "@/lib/jothrah-system-prompt";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { detectLanguage, matchCategories } from "@/lib/matcher";
import { needsWhatsapp } from "@/lib/safety";
import { buildDeterministicFertilizerResponse as buildExternalDeterministicFertilizerResponse } from "@/lib/fertilizer-calculator";
import {
  saveChatAttachment,
  saveChatEvent,
  saveChatMessage,
  uploadChatImage,
  upsertConversation,
} from "@/lib/chat-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Language = "ar" | "en";

type ChatCategory = {
  title: string;
  url: string;
};

type KnowledgeRule = {
  id: string;
  file: string;
  terms: string[];
};

type KnowledgeHit = KnowledgeRule & {
  score: number;
};

type VisionAnalysis = {
  detected_problem: string;
  possible_category_terms: string[];
  confidence: "high" | "medium" | "low";
  image_clarity: "clear" | "partial" | "unclear";
  visual_notes: string;
  whatsapp_needed: boolean;
  whatsapp_reason: string;
};

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

const KNOWLEDGE_RULES: KnowledgeRule[] = [
  {
    id: "cockroaches",
    file: "public-health/cockroaches.json",
    terms: [
      "صرصور",
      "صراصير",
      "الصراصير",
      "roach",
      "roaches",
      "cockroach",
      "cockroaches",
      "cockroach control",
    ],
  },
  {
    id: "mosquitoes",
    file: "public-health/mosquitoes.json",
    terms: ["بعوض", "ناموس", "الناموس", "البعوض", "mosquito", "mosquitoes"],
  },
  {
    id: "flies",
    file: "public-health/flies.json",
    terms: [
      "ذباب",
      "الذباب",
      "ذبابة",
      "fly",
      "flies",
      "house fly",
      "house flies",
    ],
  },
  {
    id: "termites",
    file: "public-health/termites.json",
    terms: [
      "نمل أبيض",
      "النمل الأبيض",
      "ارضه",
      "الأرضة",
      "termite",
      "termites",
      "white ants",
    ],
  },
  {
    id: "bed-bugs",
    file: "public-health/bed-bugs.json",
    terms: [
      "بق الفراش",
      "البق",
      "بق",
      "bed bug",
      "bed bugs",
      "bedbug",
      "bedbugs",
    ],
  },
  {
    id: "ants",
    file: "public-health/ants.json",
    terms: ["نمل", "النمل", "ant", "ants"],
  },
  {
    id: "rodents",
    file: "public-health/rodents.json",
    terms: [
      "فأر",
      "فار",
      "فئران",
      "جرذ",
      "جرذان",
      "قوارض",
      "mouse",
      "mice",
      "rat",
      "rats",
      "rodent",
      "rodents",
    ],
  },
  {
    id: "red-palm-weevil",
    file: "agriculture-pests/red-palm-weevil.json",
    terms: [
      "سوسة النخيل",
      "سوسة النخيل الحمراء",
      "النخيل",
      "red palm weevil",
      "palm weevil",
    ],
  },
  {
    id: "whiteflies",
    file: "agriculture-pests/whiteflies.json",
    terms: [
      "ذبابة بيضاء",
      "الذبابة البيضاء",
      "whitefly",
      "whiteflies",
      "white fly",
    ],
  },
  {
    id: "aphids",
    file: "agriculture-pests/aphids.json",
    terms: ["من", "المن", "حشرة المن", "aphid", "aphids"],
  },
  {
    id: "mites",
    file: "agriculture-pests/mites.json",
    terms: [
      "عناكب",
      "عنكبوت أحمر",
      "العنكبوت الأحمر",
      "حلم",
      "mites",
      "mite",
      "spider mite",
      "spider mites",
    ],
  },
  {
    id: "mealybugs",
    file: "agriculture-pests/mealybugs.json",
    terms: ["بق دقيقي", "البق الدقيقي", "mealybug", "mealybugs"],
  },
  {
    id: "powdery-mildew",
    file: "plant-diseases/powdery-mildew.json",
    terms: ["بياض دقيقي", "البياض الدقيقي", "powdery mildew"],
  },
  {
    id: "leaf-spots",
    file: "plant-diseases/leaf-spots.json",
    terms: [
      "تبقع",
      "بقع على الورق",
      "بقع على الأوراق",
      "بقع ورقية",
      "leaf spot",
      "leaf spots",
    ],
  },
  {
    id: "root-rot",
    file: "plant-diseases/root-rot.json",
    terms: ["عفن جذور", "تعفن الجذور", "root rot"],
  },

  {
    id: "fertilizer-operating-rules",
    file: "fertilizers/00_fertilizer_operating_rules.json",
    terms: [
      "سماد", "اسمده", "أسمدة", "تسميد", "محسن تربة", "محسنات التربة",
      "نيتروجين", "فوسفور", "بوتاسيوم", "كالسيوم", "مغنيسيوم", "حديد", "زنك", "بورون",
      "جرعة سماد", "معدل سماد", "خلط سماد", "فوائد العناصر", "نقص عناصر",
      "fertilizer", "fertiliser", "fertilizers", "soil amendment", "nitrogen", "phosphorus", "potassium", "calcium"
    ],
  },
  {
    id: "fertilizer-npk-rates",
    file: "fertilizers/fertilizer_rates_npk.json",
    terms: [
      "npk", "NPK", "20-20-20", "٢٠-٢٠-٢٠", "العناصر الكبرى", "سماد مركب",
      "كم احط", "كم أحط", "كم اضع", "كم أضع", "جرعة", "جرعه", "معدل", "معدل استخدام",
      "مساحة", "مساحه", "متر", "هكتار", "بيت محمي", "بيوت محمية", "1000 متر", "رش ورقي", "ماء الري"
    ],
  },
  {
    id: "fertilizer-micronutrients-rates",
    file: "fertilizers/fertilizer_rates_micronutrients.json",
    terms: [
      "عناصر صغرى", "العناصر الصغرى", "حديد", "نقص الحديد", "زنك", "منجنيز", "منغنيز",
      "نحاس", "بورون", "موليبدنم", "مخلب", "مخلبية", "edta", "eddha", "ortho", "رش ورقي"
    ],
  },
  {
    id: "fertilizer-humic-amino-seaweed-rates",
    file: "fertilizers/fertilizer_rates_humic_fulvic_amino_seaweed.json",
    terms: [
      "هيوميك", "هيومك", "فولفيك", "فلفيك", "احماض امينية", "أحماض أمينية",
      "امينو", "أمينو", "طحالب", "طحالب بحرية", "سي ويد", "seaweed", "humic", "fulvic", "amino"
    ],
  },
  {
    id: "fertilizer-single-rates",
    file: "fertilizers/fertilizer_rates_single_fertilizers.json",
    terms: [
      "يوريا", "نترات البوتاسيوم", "نترات كالسيوم", "نترات الكالسيوم", "سلفات بوتاسيوم",
      "سلفات أمونيوم", "سلفات الماغنيسيوم", "سلفات مغنيسيوم", "map", "mkp", "سترات البوتاسيوم", "ثيو سلفات البوتاسيوم",
      "حامض الفوسفوريك", "حمض الفوسفوريك", "فوسفوريك", "كبريتات البوتاسيوم", "كبريتات المغنيسيوم", "يوريا فوسفات"
    ],
  },
  {
    id: "fertilizer-soil-amendments-rates",
    file: "fertilizers/fertilizer_rates_soil_amendments.json",
    terms: [
      "محسنات التربة", "محسن تربة", "كبريت زراعي", "جبس زراعي", "سماد عضوي", "اسمدة عضوية",
      "أسمدة عضوية", "نثرا", "نثر", "محبب", "حبيبات", "بيتموس", "بوتنج سويل", "كوكوبيت"
    ],
  },
  {
    id: "fertilizer-mixing-rules",
    file: "fertilizers/fertilizer_mixing_rules.json",
    terms: [
      "خلط", "اخلط", "أخلط", "اخلطه", "أخلطه", "ينخلط", "قابلية الخلط", "تجربة خلط",
      "كالسيوم مع فوسفور", "نترات الكالسيوم مع", "فوسفور مع كالسيوم", "هيوميك مع", "سماد مع مبيد", "زيت معدني"
    ],
  },
  {
    id: "fertilizer-yellowing-diagnosis",
    file: "fertilizers/fertilizer_diagnosis_yellowing.json",
    terms: [
      "اصفرار", "اصفر", "صفراء", "ورق اصفر", "الاوراق صفراء", "الأوراق صفراء",
      "اصفرار الورق", "اصفرار الأوراق", "yellow leaves", "chlorosis"
    ],
  },
  {
    id: "fertilizer-general-diagnosis",
    file: "fertilizers/fertilizer_diagnosis_general.json",
    terms: [
      "النبات تعبان", "نباتي تعبان", "ضعف نمو", "ما ينمو", "تساقط", "احتراق حواف",
      "ذبول", "اجهاد", "إجهاد", "حر", "حرارة", "تزهير", "اثمار", "إثمار", "عفن الطرف الزهري"
    ],
  },
  {
    id: "fertilizer-label-reading",
    file: "fertilizers/fertilizer_label_reading.json",
    terms: [
      "ملصق", "اللصق", "جدول الاستخدام", "مكتوب على العبوة", "العبوة مكتوب", "صورة سماد",
      "كم لكل لتر", "جم لكل لتر", "مل لكل لتر", "رشاشة", "خزان", "لتر ماء"
    ],
  },
  {
    id: "fertilizer-compliance-limits",
    file: "fertilizers/fertilizer_compliance_limits.json",
    terms: [
      "ph", "pH", "الرقم الهيدروجيني", "صوديوم", "كلور", "كلوريد", "بيوريت", "ملوثات",
      "عناصر ثقيلة", "كادميوم", "رصاص", "زئبق", "نانو", "تسجيل سماد", "مسموح"
    ],
  },
  {
    id: "fertilizer-specialist-handoff",
    file: "fertilizers/fertilizer_specialist_handoff.json",
    terms: [
      "وش اشتري", "وش أشتري", "اي منتج", "أي منتج", "ارشح", "رشح", "افضل سماد", "أفضل سماد",
      "ابغى منتج", "أبغى منتج", "اعطني منتج", "عطني منتج", "برنامج تسميد", "خطة تسميد"
    ],
  },
  {
    id: "yellowing",
    file: "nutrition/yellowing.json",
    terms: [
      "اصفرار",
      "اصفرار الأوراق",
      "اصفرار الورق",
      "yellowing",
      "yellow leaves",
    ],
  },
  {
    id: "iron-deficiency",
    file: "nutrition/iron-deficiency.json",
    terms: ["نقص الحديد", "حديد", "iron deficiency", "iron"],
  },
  {
    id: "npk",
    file: "nutrition/npk.json",
    terms: [
      "سماد",
      "اسمدة",
      "أسمدة",
      "تسميد",
      "npk",
      "fertilizer",
      "fertiliser",
      "fertilizers",
    ],
  },
  {
    id: "seeds",
    file: "seasonal/saudi-months.json",
    terms: [
      "بذور",
      "زراعة البذور",
      "موسم الزراعة",
      "seeds",
      "seed",
      "planting season",
    ],
  },
];

function corsHeaders(origin?: string | null) {
  const rawAllowedOrigins = process.env.ALLOWED_ORIGIN || "https://jothrah.com";

  const allowedOrigins = rawAllowedOrigins
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const allowedOrigin =
    origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0] || "https://jothrah.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json(
    {},
    { headers: corsHeaders(req.headers.get("origin")) },
  );
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({ apiKey });
}

function getModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreKnowledgeRule(
  rule: KnowledgeRule,
  message: string,
  categories: ChatCategory[],
) {
  const haystack = normalizeText(
    [message, ...categories.map((category) => category.title || "")].join(" "),
  );

  let score = 0;

  for (const term of rule.terms) {
    const normalizedTerm = normalizeText(term);

    if (!normalizedTerm) continue;

    if (haystack.includes(normalizedTerm)) {
      score += normalizedTerm.length >= 8 ? 6 : 4;
    }
  }

  return score;
}

function selectKnowledgeFiles(
  message: string,
  categories: ChatCategory[],
): KnowledgeHit[] {
  return KNOWLEDGE_RULES.map((rule) => ({
    ...rule,
    score: scoreKnowledgeRule(rule, message, categories),
  }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function isFertilizerKnowledgeHit(hits: KnowledgeHit[]) {
  return hits.some((hit) => hit.file.startsWith("fertilizers/"));
}

function isFertilizerProductSelectionRequest(message: string) {
  const text = normalizeText(message);

  if (!text) return false;

  const terms = [
    "وش اشتري",
    "اي منتج",
    "ارشح",
    "رشح",
    "افضل سماد",
    "ابغي منتج",
    "ابي منتج",
    "اعطني منتج",
    "عطني منتج",
    "برنامج تسميد",
    "خطه تسميد",
    "خطة تسميد",
    "what should i buy",
    "recommend product",
    "best fertilizer",
  ];

  return terms.some((term) => text.includes(normalizeText(term)));
}

function shouldUseObjectKey(key: string, language: Language) {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === "ar" || normalizedKey === "arabic") {
    return language === "ar";
  }

  if (normalizedKey === "en" || normalizedKey === "english") {
    return language === "en";
  }

  if (normalizedKey.endsWith("_ar")) {
    return language === "ar";
  }

  if (normalizedKey.endsWith("_en")) {
    return language === "en";
  }

  return true;
}

function cleanKnowledgeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function collectKnowledgeText(
  value: unknown,
  language: Language,
  lines: string[],
  keyPath = "",
  depth = 0,
) {
  if (lines.length >= 80) return;
  if (depth > 8) return;
  if (value === null || value === undefined) return;

  if (typeof value === "string") {
    const cleaned = cleanKnowledgeLine(value);

    if (cleaned && cleaned.length >= 2) {
      lines.push(keyPath ? `${keyPath}: ${cleaned}` : cleaned);
    }

    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    lines.push(keyPath ? `${keyPath}: ${String(value)}` : String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectKnowledgeText(item, language, lines, keyPath, depth + 1);
      if (lines.length >= 80) break;
    }

    return;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);

    for (const [key, childValue] of entries) {
      if (!shouldUseObjectKey(key, language)) continue;

      const nextKeyPath = keyPath ? `${keyPath}.${key}` : key;

      collectKnowledgeText(childValue, language, lines, nextKeyPath, depth + 1);

      if (lines.length >= 80) break;
    }
  }
}

async function readKnowledgeFile(
  relativeFile: string,
  language: Language,
): Promise<string | null> {
  const possiblePaths = [
    path.join(process.cwd(), "app", "data", "knowledge", relativeFile),
    path.join(process.cwd(), "data", "knowledge", relativeFile),
  ];

  for (const fullPath of possiblePaths) {
    try {
      const raw = await fs.readFile(fullPath, "utf8");
      const parsed = JSON.parse(raw);

      const lines: string[] = [];
      collectKnowledgeText(parsed, language, lines);

      const content = lines
        .filter(Boolean)
        .slice(0, 80)
        .join("\n")
        .slice(0, 6000);

      if (!content.trim()) return null;

      return `Knowledge file: ${fullPath}\n${content}`;
    } catch {
      // جرّب المسار التالي؛ بعض نسخ المشروع تحفظ المعرفة داخل app/data وبعضها داخل data.
    }
  }

  console.warn(`Knowledge file not loaded from any known path: ${relativeFile}`, possiblePaths);
  return null;
}

async function buildKnowledgeContext(hits: KnowledgeHit[], language: Language) {
  if (!hits.length) {
    return language === "ar"
      ? "لم يتم العثور على ملف معرفة تفصيلي مطابق. استخدم الإرشادات العامة فقط ولا تخترع تفاصيل."
      : "No matching detailed knowledge file was found. Use general guidance only and do not invent details.";
  }

  const loadedFiles = await Promise.all(
    hits.map((hit) => readKnowledgeFile(hit.file, language)),
  );

  const context = loadedFiles.filter(Boolean).join("\n\n---\n\n");

  if (!context.trim()) {
    return language === "ar"
      ? "تمت مطابقة المشكلة، لكن ملفات المعرفة لم تُقرأ من الخادم. استخدم الإرشادات العامة فقط ولا تخترع تفاصيل."
      : "The issue was matched, but knowledge files could not be read from the server. Use general guidance only and do not invent details.";
  }

  return context;
}

async function loadRecentConversationContext(
  conversationId: string,
  language: Language,
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .select("sender_type,message,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error || !data?.length) return "";

    return data
      .slice()
      .reverse()
      .map((item: any) => {
        const sender = String(item.sender_type || "");
        const label =
          sender === "customer"
            ? language === "ar"
              ? "العميل"
              : "Customer"
            : language === "ar"
              ? "المساعد"
              : "Assistant";
        const body = String(item.message || "").replace(/\s+/g, " ").trim();
        return body ? `${label}: ${body}` : "";
      })
      .filter(Boolean)
      .join("\n")
      .slice(-3000);
  } catch (error) {
    console.warn("Recent chat context not loaded:", error);
    return "";
  }
}

async function imageFileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mime = file.type || "image/jpeg";

  return `data:${mime};base64,${base64}`;
}

function isAllowedImageType(type: string) {
  return [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ].includes(type.toLowerCase());
}

function normalizeLanguage(
  value: unknown,
  fallback: Language = "ar",
): Language {
  const text = String(value || "").toLowerCase();

  if (text.startsWith("en")) return "en";
  if (text.startsWith("ar")) return "ar";

  return fallback;
}

function fallbackVisionAnalysis(language: Language): VisionAnalysis {
  return {
    detected_problem: language === "ar" ? "غير واضح" : "Unclear",
    possible_category_terms: [],
    confidence: "low",
    image_clarity: "unclear",
    visual_notes:
      language === "ar"
        ? "لم أتمكن من تحليل الصورة بشكل كافٍ."
        : "The image could not be analyzed clearly.",
    whatsapp_needed: true,
    whatsapp_reason:
      language === "ar"
        ? "الصورة غير واضحة أو تحتاج فحص مباشر."
        : "The image is unclear or needs direct review.",
  };
}

async function analyzeImageFirst(params: {
  client: OpenAI;
  imageDataUrl: string;
  message: string;
  language: Language;
}): Promise<VisionAnalysis> {
  const { client, imageDataUrl, message, language } = params;

  const prompt =
    language === "ar"
      ? `
حلل الصورة كخبير مبدئي في آفات الصحة العامة والزراعة لمتجر جذرة.

المطلوب:
- حدد ما الذي يظهر بالصورة إن أمكن.
- هل هي حشرة منزلية؟ آفة نباتية؟ مرض نبات؟ أثر قارض؟ ملصق سماد/جدول استخدام؟ أم غير واضح؟
- إذا كانت الصورة ملصق سماد أو جدول استخدام، استخرج نوع السماد والتركيبة ومعدل الاستخدام ووحدة القياس إن ظهرت.
- لا تجزم إذا الصورة غير واضحة.
- لا تعطي جرعات مبيدات.
- لا تحسب جرعة سماد نهائية في تحليل الصورة الأولي إذا كان سطر المعدل غير واضح.
- إذا كانت الصورة غير واضحة أو الحالة خطرة أو تحتاج تشخيص مباشر، اجعل whatsapp_needed = true.

رسالة العميل:
${message || "لا توجد رسالة، الصورة فقط."}

أعد JSON فقط.
`
      : `
Analyze the image as an initial public-health and agricultural pest assistant for Jothrah.

Required:
- Identify what appears in the image if possible.
- Is it a household insect, plant pest, plant disease, rodent sign, fertilizer label/rate table, or unclear?
- If it is a fertilizer label or rate table, extract fertilizer type, composition, application rate, and unit if visible.
- Do not be overconfident if the image is unclear.
- Do not provide pesticide dosage.
- Do not calculate a final fertilizer dose in the initial image analysis if the rate line is unclear.
- If the image is unclear, risky, or needs direct review, set whatsapp_needed = true.

Customer message:
${message || "No message, image only."}

Return JSON only.
`;

  try {
    const completion = await client.chat.completions.create({
      model: getModel(),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
          ] as any,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "jothrah_image_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              detected_problem: {
                type: "string",
              },
              possible_category_terms: {
                type: "array",
                items: {
                  type: "string",
                },
                maxItems: 6,
              },
              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
              image_clarity: {
                type: "string",
                enum: ["clear", "partial", "unclear"],
              },
              visual_notes: {
                type: "string",
              },
              whatsapp_needed: {
                type: "boolean",
              },
              whatsapp_reason: {
                type: "string",
              },
            },
            required: [
              "detected_problem",
              "possible_category_terms",
              "confidence",
              "image_clarity",
              "visual_notes",
              "whatsapp_needed",
              "whatsapp_reason",
            ],
          },
        },
      },
      max_completion_tokens: 500,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as VisionAnalysis;

    return parsed;
  } catch (error) {
    console.warn("Image analysis failed:", error);
    return fallbackVisionAnalysis(language);
  }
}

function buildVisionContext(
  imageDataUrl: string | null,
  visionAnalysis: VisionAnalysis | null,
  language: Language,
) {
  if (!imageDataUrl) {
    return language === "ar" ? "لا توجد صورة مرفقة." : "No image was attached.";
  }

  if (!visionAnalysis) {
    return language === "ar"
      ? "تم إرفاق صورة، لكن لم يتم تحليلها."
      : "An image was attached, but it was not analyzed.";
  }

  return `
Image was analyzed first.

Detected problem:
${visionAnalysis.detected_problem}

Possible category terms:
${visionAnalysis.possible_category_terms.join(", ")}

Confidence:
${visionAnalysis.confidence}

Image clarity:
${visionAnalysis.image_clarity}

Visual notes:
${visionAnalysis.visual_notes}

Vision WhatsApp needed:
${visionAnalysis.whatsapp_needed}

Vision WhatsApp reason:
${visionAnalysis.whatsapp_reason}
`.trim();
}

function shouldForceWhatsappFromVision(visionAnalysis: VisionAnalysis | null) {
  if (!visionAnalysis) return false;

  if (visionAnalysis.whatsapp_needed) return true;
  if (visionAnalysis.confidence === "low") return true;
  if (visionAnalysis.image_clarity === "unclear") return true;

  const sensitive = normalizeText(
    [
      visionAnalysis.detected_problem,
      visionAnalysis.visual_notes,
      visionAnalysis.whatsapp_reason,
      ...visionAnalysis.possible_category_terms,
    ].join(" "),
  );

  const sensitiveTerms = [
    "نمل ابيض",
    "ارضه",
    "بق الفراش",
    "قوارض",
    "فئران",
    "جرذان",
    "سوسه النخيل",
    "termite",
    "bed bug",
    "rodent",
    "rat",
    "mouse",
    "red palm weevil",
    "unclear",
  ];

  return sensitiveTerms.some((term) => sensitive.includes(normalizeText(term)));
}


function cleanAiSummary(value: unknown) {
  let summary = String(value || "").trim();

  // يمنع تكرار العناوين داخل الشات إذا النموذج كتب "نصائح مباشرة" داخل الملخص.
  summary = summary
    .replace(/\n?\s*(نصائح مباشرة|Direct advice)\s*[:：]\s*/gi, "\n")
    .replace(/\n?\s*(تشخيص مبدئي|Initial diagnosis)\s*[:：]\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return summary;
}

function buildStoredAiMessage(data: any, language: Language) {
  const parts: string[] = [];
  const summary = cleanAiSummary(data?.summary);

  if (summary) parts.push(summary);

  if (Array.isArray(data?.advice) && data.advice.length) {
    const advice = data.advice
      .map((item: unknown) => String(item || "").trim())
      .filter(Boolean);

    if (advice.length) {
      parts.push(
        `${language === "ar" ? "نصائح مباشرة" : "Direct advice"}:\n${advice.join("\n")}`,
      );
    }
  }

  if (Array.isArray(data?.questions) && data.questions.length) {
    const questions = data.questions
      .map((item: unknown) => String(item || "").trim())
      .filter(Boolean);

    if (questions.length) {
      parts.push(
        `${language === "ar" ? "أسئلة متابعة" : "Follow-up questions"}:\n${questions.join("\n")}`,
      );
    }
  }

  if (Array.isArray(data?.categories) && data.categories.length) {
    const categories = data.categories
      .map((item: any) => String(item?.title || "").trim())
      .filter(Boolean);

    if (categories.length) {
      parts.push(
        `${language === "ar" ? "تصنيفات مناسبة" : "Suitable categories"}:\n${categories.join("\n")}`,
      );
    }
  }

  return parts.join("\n\n").slice(0, 3500) || summary;
}


type JothrahChatResponse = {
  language: Language;
  analysis_source: "text" | "image" | "image_and_text";
  detected_problem: string;
  confidence: "high" | "medium" | "low";
  summary: string;
  advice: string[];
  questions: string[];
  categories: ChatCategory[];
  product_suggestions: { name: string; url: string; reason: string }[];
  whatsapp_needed: boolean;
  whatsapp_message: string;
};

function fertilizerCategory(language: Language): ChatCategory[] {
  return [
    {
      title: language === "ar" ? "الأسمدة ومحسنات التربة" : "Fertilizers and Soil Amendments",
      url: "https://jothrah.com/",
    },
  ];
}

function makeFertilizerResponse(params: {
  language: Language;
  analysisSource: "text" | "image" | "image_and_text";
  detectedProblem: string;
  summary: string;
  advice?: string[];
  questions?: string[];
  confidence?: "high" | "medium" | "low";
  whatsappNeeded?: boolean;
  whatsappMessage?: string;
}): JothrahChatResponse {
  const { language } = params;

  return {
    language,
    analysis_source: params.analysisSource,
    detected_problem: params.detectedProblem,
    confidence: params.confidence || "high",
    summary: params.summary,
    advice: (params.advice || []).filter(Boolean).slice(0, 3),
    questions: (params.questions || []).filter(Boolean).slice(0, 2),
    categories: fertilizerCategory(language),
    product_suggestions: [],
    whatsapp_needed: Boolean(params.whatsappNeeded),
    whatsapp_message: params.whatsappMessage || "",
  };
}

function normalizeFertilizerText(value: string) {
  return normalizeText(value)
    .replace(/[٠۰]/g, "0")
    .replace(/[١۱]/g, "1")
    .replace(/[٢۲]/g, "2")
    .replace(/[٣۳]/g, "3")
    .replace(/[٤۴]/g, "4")
    .replace(/[٥۵]/g, "5")
    .replace(/[٦۶]/g, "6")
    .replace(/[٧۷]/g, "7")
    .replace(/[٨۸]/g, "8")
    .replace(/[٩۹]/g, "9")
    .replace(/نترت/g, "نترات")
    .replace(/نترات كلسيوم/g, "نترات كالسيوم")
    .replace(/كلسيوم/g, "كالسيوم")
    .replace(/هيومك/g, "هيوميك")
    .replace(/هيموك/g, "هيوميك")
    .replace(/فلفيك/g, "فولفيك")
    .replace(/بي اتش/g, "ph")
    .replace(/بى اتش/g, "ph")
    .replace(/البي اتش/g, "ph");
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalizeFertilizerText(term)));
}

function extractAreaSquareMeters(text: string) {
  const normalized = normalizeFertilizerText(text);
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:متر|م2|م²|m2|sqm|square meter)/i);

  if (!match) return null;

  const area = Number(match[1]);
  return Number.isFinite(area) && area > 0 ? area : null;
}

function formatRange(min: number, max: number, unit: string) {
  const format = (value: number) =>
    Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

  return `${format(min)}–${format(max)} ${unit}`;
}

function looksLikeFertilizerQuestion(text: string) {
  return includesAny(text, [
    "سماد",
    "اسمده",
    "اسمدة",
    "تسميد",
    "npk",
    "نترات",
    "كالسيوم",
    "زنك",
    "بورون",
    "حديد",
    "مغنيسيوم",
    "فوسفور",
    "فوسفوريك",
    "هيوميك",
    "فولفيك",
    "احماض امينيه",
    "طحالب",
    "ph",
    "محسن تربه",
    "fertilizer",
    "fertiliser",
  ]);
}

function isMixingQuestion(text: string) {
  return includesAny(text, [
    "اخلط",
    "اخلطه",
    "خلط",
    "ينخلط",
    "ينفع اخلط",
    "قابليه الخلط",
    "قابلية الخلط",
    "مع بعض",
    "mix",
    "mixing",
  ]);
}

function isPhQuestion(text: string) {
  return includesAny(text, ["ph", "الرقم الهيدروجيني", "الهيدروجيني", "حموضه", "حموضة"]);
}

function isLabelQuestion(text: string) {
  return includesAny(text, ["ملصق", "بيانات الملصق", "اللصق", "بطاقه", "بطاقة", "label"]);
}

function isRateQuestion(text: string) {
  return includesAny(text, [
    "كيف استخدم",
    "طريقة الاستخدام",
    "طريقه الاستخدام",
    "كم احط",
    "كم اضع",
    "جرعه",
    "جرعة",
    "معدل",
    "مساحه",
    "مساحة",
    "لتر ماء",
    "بيت محمي",
    "بيوت محميه",
    "محبب",
    "ذواب",
    "rate",
    "dose",
  ]);
}

function hasNpkRatio(text: string) {
  const normalized = normalizeFertilizerText(text);
  return /\b\d{1,2}\s*[-\/ ]\s*\d{1,2}\s*[-\/ ]\s*\d{1,2}\b/.test(normalized) || normalized.includes("npk");
}

function buildFertilizerMixingResponse(params: {
  message: string;
  recentContext: string;
  language: Language;
  analysisSource: "text" | "image" | "image_and_text";
}): JothrahChatResponse | null {
  const { language, analysisSource } = params;
  const text = normalizeFertilizerText(`${params.recentContext}\n${params.message}`);

  if (!isMixingQuestion(text) || !looksLikeFertilizerQuestion(text)) return null;

  const hasCalcium = includesAny(text, ["كالسيوم", "نترات كالسيوم", "نترات الكالسيوم", "calcium"]);
  const hasZinc = includesAny(text, ["زنك", "zinc", "zn"]);
  const hasBoron = includesAny(text, ["بورون", "boron"]);
  const hasMolybdenum = includesAny(text, ["موليبدنم", "موليبدينوم", "molybdenum", "mo"]);
  const hasPhosphorus = includesAny(text, ["فوسفور", "فوسفوريك", "حمض فوسفوريك", "حامض الفوسفوريك", "map", "mkp", "phosphorus", "phosphoric"]);
  const hasSulfur = includesAny(text, ["كبريت", "سلفات", "sulfur", "sulphur", "sulfate", "sulphate"]);
  const hasUrea = includesAny(text, ["يوريا", "urea"]);
  const hasHumic = includesAny(text, ["هيوميك", "humic"]);
  const hasAcid = includesAny(text, ["حمض", "حامض", "acid"]);
  const hasMineralOil = includesAny(text, ["زيت معدني", "زيوت معدنيه", "mineral oil"]);
  const hasPotassiumNitrate = includesAny(text, ["نترات البوتاسيوم", "potassium nitrate"]);

  if (hasBoron || hasMolybdenum) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "سؤال خلط عناصر صغرى" : "Micronutrient mixing question",
      summary:
        language === "ar"
          ? "البورون والموليبدنم من العناصر التي لا تُعامل كخلط عام مع بقية الأسمدة. لا أنصح بخلطها مباشرة في نفس الخزان إلا إذا نص ملصق المنتجين على ذلك بوضوح."
          : "Boron and molybdenum should not be treated as general tank-mix nutrients. Do not mix them directly unless both product labels clearly allow it.",
      advice:
        language === "ar"
          ? [
              "افصل الإضافة أو اعمل تجربة خلط صغيرة فقط إذا كان الملصق يسمح.",
              "لا تعتمد على أن كل العناصر الصغرى قابلة للخلط؛ البورون والموليبدنم أكثر حساسية.",
              "إذا كان الاستخدام رشًا ورقيًا، التزم بملصق المنتج ولا ترفع التركيز من نفسك.",
            ]
          : [
              "Separate applications, or run a small jar test only if the label allows mixing.",
              "Do not assume all micronutrients are compatible; boron and molybdenum are more sensitive.",
              "For foliar use, follow the label and do not increase concentration yourself.",
            ],
      questions:
        language === "ar"
          ? ["هل الخلط للرش الورقي أم مع ماء الري؟", "ما اسم المنتجين أو صورة الملصق؟"]
          : ["Is this for foliar spraying or irrigation?", "What are the two product names or label photos?"],
    });
  }

  if (hasCalcium && hasPhosphorus) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "عدم توافق كالسيوم مع فوسفور" : "Calcium and phosphorus incompatibility",
      summary:
        language === "ar"
          ? "لا، لا أنصح بخلط الكالسيوم مع الفوسفور أو حمض الفوسفوريك في نفس الخزان. القاعدة العامة أن الفوسفور لا يقبل الخلط مع الكالسيوم."
          : "No. Do not mix calcium with phosphorus or phosphoric acid in the same tank. The general rule is that phosphorus is not compatible with calcium.",
      advice:
        language === "ar"
          ? [
              "افصل الإضافتين في وقتين مختلفين أو خزانات منفصلة.",
              "لا تخلط حمض الفوسفوريك مع نترات الكالسيوم.",
              "اعمل تجربة خلط صغيرة فقط إذا كان ملصق المنتجين يسمح صراحة، وليس كقاعدة عامة.",
            ]
          : [
              "Apply them separately or in different tanks.",
              "Do not mix phosphoric acid with calcium nitrate.",
              "Only run a jar test if both labels explicitly allow mixing; do not use it as a general rule.",
            ],
      questions: language === "ar" ? ["هل الاستخدام مع ماء الري أم رش ورقي؟"] : ["Is this through irrigation or foliar spraying?"],
    });
  }

  if (hasCalcium && hasSulfur) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "عدم توافق كالسيوم مع كبريت/سلفات" : "Calcium and sulfur/sulfate incompatibility",
      summary:
        language === "ar"
          ? "لا يُنصح بخلط الكالسيوم مع الكبريت أو السلفات في نفس الخزان. القاعدة العامة أن الكالسيوم لا يقبل الخلط مع الكبريت."
          : "Do not mix calcium with sulfur or sulfates in the same tank. The general rule is that calcium is not compatible with sulfur.",
      advice:
        language === "ar"
          ? ["افصل نترات الكالسيوم عن الأسمدة السلفاتية.", "نظف الخزان أو شبكة الري بين الإضافات عند الحاجة.", "ارجع لملصق المنتجين قبل أي خلط."]
          : ["Separate calcium nitrate from sulfate fertilizers.", "Flush the tank or irrigation line between applications when needed.", "Check both product labels before any mix."],
      questions: language === "ar" ? ["ما اسم السماد السلفاتي الذي تريد خلطه؟"] : ["Which sulfate fertilizer do you want to mix?"],
    });
  }

  if (hasCalcium && hasUrea) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "نترات كالسيوم مع يوريا" : "Calcium nitrate and urea",
      summary:
        language === "ar"
          ? "لا أنصح بخلط نترات الكالسيوم مع اليوريا في نفس الخزان. الأفضل فصل الإضافة والرجوع لملصق المنتج."
          : "Do not mix calcium nitrate with urea in the same tank. Separate applications and follow the product labels.",
      advice:
        language === "ar"
          ? ["افصل الإضافة لتجنب مشاكل التوافق.", "استخدم ماء نظيفًا واشطف الخزان بين الإضافات.", "لا ترفع التركيز بهدف التعويض."]
          : ["Separate applications to avoid compatibility issues.", "Use clean water and flush the tank between applications.", "Do not increase concentration to compensate."],
      questions: language === "ar" ? ["هل الإضافة عبر التنقيط أم الرش؟"] : ["Is the application through drip irrigation or spraying?"],
    });
  }

  if (hasCalcium && hasZinc) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "خلط كالسيوم مع زنك" : "Calcium and zinc mixing",
      summary:
        language === "ar"
          ? "تصحيح المقصود: غالبًا تقصد نترات كالسيوم مع زنك. القاعدة العامة أن العناصر الصغرى مثل الزنك لا تُخلط مباشرة مع الكالسيوم إلا إذا سمح ملصق المنتجين بوضوح."
          : "You likely mean calcium nitrate with zinc. As a general rule, micronutrients such as zinc should not be directly mixed with calcium unless both labels clearly allow it.",
      advice:
        language === "ar"
          ? [
              "افصل إضافة نترات الكالسيوم عن الزنك، خصوصًا إذا كان الزنك سلفات أو ضمن خليط عناصر صغرى.",
              "لو كان الزنك مخلبًا، لا يزال الملصق هو المرجع وليس اسم المخلب وحده.",
              "اعمل تجربة خلط صغيرة فقط بعد التأكد من ملصق المنتجين.",
            ]
          : [
              "Separate calcium nitrate from zinc, especially if zinc is sulfate or part of a micronutrient blend.",
              "Even if zinc is chelated, the label is the reference—not the chelate name alone.",
              "Run a small jar test only after checking both labels.",
            ],
      questions:
        language === "ar"
          ? ["هل الزنك مخلب EDTA أم سلفات أو خليط عناصر صغرى؟", "هل الاستخدام رش ورقي أم مع ماء الري؟"]
          : ["Is the zinc EDTA-chelated, sulfate, or part of a micronutrient mix?", "Is this foliar or through irrigation?"],
    });
  }

  if (hasHumic && (hasAcid || hasCalcium)) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "خلط هيوميك" : "Humic mixing",
      summary:
        language === "ar"
          ? "الهيوميك لا يقبل الخلط مع الأحماض ولا مع التركيزات العالية من الكالسيوم. الأفضل فصله في إضافة مستقلة."
          : "Humic acid is not compatible with acids or high calcium concentrations. It is best applied separately.",
      advice:
        language === "ar"
          ? ["لا تخلط الهيوميك مع حمض الفوسفوريك.", "لا تخلطه مع جرعات كالسيوم عالية.", "اتبع ملصق المنتج واعمل تجربة صغيرة عند الحاجة."]
          : ["Do not mix humic with phosphoric acid.", "Do not mix it with high calcium doses.", "Follow the label and run a small jar test when needed."],
      questions: language === "ar" ? ["هل الهيوميك سائل أم صلب؟"] : ["Is the humic product liquid or solid?"],
    });
  }

  if (hasMineralOil) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "خلط الزيوت المعدنية" : "Mineral oil mixing",
      summary:
        language === "ar"
          ? "الزيوت المعدنية لا تُخلط مع أي سماد كقاعدة عامة. افصل استخدامها واتبع ملصق المنتج."
          : "Mineral oils should not be mixed with any fertilizer as a general rule. Apply separately and follow the label.",
      advice:
        language === "ar"
          ? ["لا تستخدم الزيت المعدني داخل خزان تسميد.", "افصل الرش أو الإضافة بفاصل مناسب حسب الملصق.", "تجنب الرش وقت الحرارة العالية."]
          : ["Do not use mineral oil inside a fertilizer tank.", "Separate applications according to the label interval.", "Avoid spraying during high heat."],
      questions: [],
    });
  }

  if (hasPotassiumNitrate) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "خلط نترات البوتاسيوم" : "Potassium nitrate mixing",
      summary:
        language === "ar"
          ? "نترات البوتاسيوم تقبل الخلط مع أغلب الأسمدة كقاعدة عامة، لكن يفضّل دائمًا عمل تجربة خلط صغيرة واتباع ملصق المنتج."
          : "Potassium nitrate is generally compatible with most fertilizers, but a small jar test and label guidance are still recommended.",
      advice:
        language === "ar"
          ? ["استخدم ماء نظيفًا وذوّب المنتج جيدًا.", "لا تخلط مع منتجات غير معروفة التركيب.", "راقب أي ترسب أو تعكر قبل الاستخدام الواسع."]
          : ["Use clean water and dissolve the product well.", "Do not mix with products of unknown composition.", "Watch for precipitation or cloudiness before broad use."],
      questions: language === "ar" ? ["ما السماد الآخر الذي تريد خلطه معه؟"] : ["Which other fertilizer do you want to mix it with?"],
    });
  }

  return makeFertilizerResponse({
    language,
    analysisSource,
    detectedProblem: language === "ar" ? "سؤال عام عن خلط الأسمدة" : "General fertilizer mixing question",
    summary:
      language === "ar"
        ? "لا أقدر أحكم على الخلط بدقة من اسم عام فقط. قابلية الخلط تعتمد على نوع السماد، صورته الكيميائية، التركيز، طريقة الاستخدام، وملصق المنتجين."
        : "I cannot judge compatibility accurately from a general name only. Mixing depends on fertilizer type, chemical form, concentration, application method, and both labels.",
    advice:
      language === "ar"
        ? ["لا تخلط أسمدة عشوائيًا في نفس الخزان.", "ابدأ دائمًا بقراءة قابلية الخلط على الملصق.", "اعمل تجربة خلط صغيرة قبل أي استخدام واسع إذا كان الخلط مسموحًا."]
        : ["Do not randomly mix fertilizers in the same tank.", "Always check the compatibility section on the label.", "Run a small jar test before broad use if mixing is allowed."],
    questions:
      language === "ar" ? ["ما أسماء الأسمدة التي تريد خلطها بالضبط؟", "هل الاستخدام رش ورقي أم مع ماء الري؟"] : ["What exact fertilizers do you want to mix?", "Is this foliar spraying or irrigation?"],
    confidence: "medium",
  });
}

function buildFertilizerPhResponse(params: {
  message: string;
  recentContext: string;
  language: Language;
  analysisSource: "text" | "image" | "image_and_text";
}): JothrahChatResponse | null {
  const { language, analysisSource } = params;
  const text = normalizeFertilizerText(`${params.recentContext}\n${params.message}`);

  if (!isPhQuestion(text) || !looksLikeFertilizerQuestion(text)) return null;

  const isLiquid = includesAny(text, ["سائل", "السائل", "liquid"]);
  const isSolid = includesAny(text, ["صلب", "بودر", "مسحوق", "حبيبات", "محبب", "solid", "powder", "granular"]);
  const hasHumic = includesAny(text, ["هيوميك", "humic"]);
  const hasFulvic = includesAny(text, ["فولفيك", "fulvic"]);
  const hasNpk = hasNpkRatio(text) || includesAny(text, ["العناصر الكبري", "العناصر الكبرى"]);
  const hasSeaweed = includesAny(text, ["طحالب", "طحالب بحريه", "seaweed"]);
  const hasAmino = includesAny(text, ["احماض امينيه", "أحماض أمينية", "amino"]);

  if (hasHumic || hasFulvic) {
    const answer = isLiquid
      ? language === "ar"
        ? "الحد الأعلى للهيوميك/الفولفيك السائل هو pH 8.5."
        : "The upper pH limit for liquid humic/fulvic products is 8.5."
      : isSolid
        ? language === "ar"
          ? "الحد الأعلى للهيوميك/الفولفيك الصلب هو pH 11."
          : "The upper pH limit for solid humic/fulvic products is 11."
        : language === "ar"
          ? "الهيوميك/الفولفيك يختلف حسب الصورة: السائل حدّه الأعلى pH 8.5، والصلب حدّه الأعلى pH 11."
          : "Humic/fulvic limits depend on form: liquid upper pH is 8.5, and solid upper pH is 11.";

    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "pH الهيوميك/الفولفيك" : "Humic/Fulvic pH",
      summary: answer,
      advice:
        language === "ar"
          ? ["تأكد هل المنتج سائل أم صلب قبل الحكم.", "راجع شهادة التحليل والملصق لأن pH جزء من بيانات التسجيل.", "لا تخلط الهيوميك مع الأحماض أو تركيز عالٍ من الكالسيوم."]
          : ["Confirm whether the product is liquid or solid before judging.", "Check the analysis certificate and label because pH is part of registration data.", "Do not mix humic with acids or high calcium concentration."],
      questions: isLiquid || isSolid ? [] : language === "ar" ? ["هل المنتج سائل أم صلب؟"] : ["Is the product liquid or solid?"],
    });
  }

  if (hasNpk) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "pH سماد NPK" : "NPK fertilizer pH",
      summary:
        language === "ar"
          ? "أسمدة العناصر الكبرى المركبة NPK المفترض ألا يزيد رقمها الهيدروجيني عن pH 7."
          : "Compound major-element NPK fertilizers should not exceed pH 7.",
      advice:
        language === "ar"
          ? ["راجع pH في الملصق أو شهادة التحليل.", "لا تعتمد على الاسم التجاري فقط؛ التركيبة والصورة مهمة.", "إذا كان المنتج سائلًا أو معلقًا، راجع كذلك الكثافة والكلوريد والصوديوم."]
          : ["Check pH on the label or analysis certificate.", "Do not rely on the trade name only; composition and form matter.", "For liquid or suspension products, also check density, chloride, and sodium."],
      questions: [],
    });
  }

  if (hasSeaweed) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "pH الطحالب البحرية" : "Seaweed pH",
      summary: language === "ar" ? "الطحالب البحرية: الحد الأعلى pH 8 للمنتج الصلب، وpH 7 للمنتج السائل." : "Seaweed products: upper pH is 8 for solid products and 7 for liquid products.",
      advice: language === "ar" ? ["حدد صورة المنتج قبل الحكم.", "راجع الملصق وشهادة التحليل."] : ["Confirm product form before judging.", "Check the label and analysis certificate."],
      questions: isLiquid || isSolid ? [] : language === "ar" ? ["هل الطحالب سائلة أم صلبة؟"] : ["Is the seaweed product liquid or solid?"],
    });
  }

  if (hasAmino) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "pH الأحماض الأمينية" : "Amino acid pH",
      summary: language === "ar" ? "الأحماض الأمينية حدها الأعلى pH 7 سواء كانت صلبة أو سائلة." : "Amino acid fertilizers have an upper pH limit of 7 whether solid or liquid.",
      advice: language === "ar" ? ["راجع مصدر الأحماض الأمينية ونسبتها الحرة والكلية.", "تأكد أن البيانات مطابقة للملصق وشهادة التحليل."] : ["Check amino acid source and free/total amino acid percentages.", "Make sure label and analysis certificate match."],
      questions: [],
    });
  }

  return makeFertilizerResponse({
    language,
    analysisSource,
    detectedProblem: language === "ar" ? "سؤال pH لسماد" : "Fertilizer pH question",
    summary: language === "ar" ? "pH المسموح يختلف حسب نوع السماد وصورته. لا أقدر أحدده بدقة قبل معرفة نوع المنتج: NPK، هيوميك، فولفيك، أحماض أمينية، طحالب، أو غيرها." : "Allowed pH depends on fertilizer type and form. I need to know whether it is NPK, humic, fulvic, amino acids, seaweed, or another fertilizer.",
    advice: language === "ar" ? ["اكتب نوع السماد وصورته: سائل أم صلب.", "راجع خانة pH في الملصق أو شهادة التحليل.", "لا تقارن pH منتج بآخر إلا إذا كانا من نفس النوع والصورة."] : ["Provide fertilizer type and form: liquid or solid.", "Check the pH field on the label or analysis certificate.", "Do not compare pH across different product types/forms."],
    questions: language === "ar" ? ["ما نوع السماد؟", "هل هو سائل أم صلب؟"] : ["What fertilizer type is it?", "Is it liquid or solid?"],
    confidence: "medium",
  });
}

function buildFertilizerRateResponse(params: {
  message: string;
  recentContext: string;
  language: Language;
  analysisSource: "text" | "image" | "image_and_text";
}): JothrahChatResponse | null {
  const { language, analysisSource } = params;
  const combined = `${params.recentContext}\n${params.message}`;
  const text = normalizeFertilizerText(combined);

  if (!isRateQuestion(text) || !looksLikeFertilizerQuestion(text)) return null;

  const area = extractAreaSquareMeters(text);
  const greenhouse = includesAny(text, ["بيت محمي", "بيوت محميه", "محمية", "محمي", "greenhouse"]);
  const granular = includesAny(text, ["محبب", "حبيبات", "نثر", "نثرا", "granular", "broadcast"]);
  const liquid = includesAny(text, ["سائل", "liquid"]);
  const soluble = includesAny(text, ["ذواب", "ذائب", "بودر", "مع ماء الري", "water soluble", "soluble"]);
  const npk = hasNpkRatio(text);

  if (npk && greenhouse && area && granular) {
    const min = (15 / 1000) * area;
    const max = (30 / 1000) * area;

    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "معدل NPK محبب للبيوت المحمية" : "Granular NPK greenhouse rate",
      summary: language === "ar" ? `لسماد NPK محبب يُضاف نثرًا في بيت محمي، المعدل الاسترشادي هو 15–30 كجم / 1000 م². لمساحة ${area} م² يكون المعدل التقريبي ${formatRange(min, max, "كجم")}.` : `For granular NPK broadcast in a greenhouse, the reference rate is 15–30 kg / 1000 m². For ${area} m², the approximate range is ${formatRange(min, max, "kg")}.`,
      advice: language === "ar" ? ["وزّعه بالتساوي حول منطقة الجذور أو بين الخطوط، ثم اسقِ مباشرة.", "لا تذوبه في الخزان إلا إذا كان الملصق يقول إنه ذواب بالكامل.", "هذه معدلات استرشادية وتختلف حسب تحليل التربة والمياه ونوع المحصول ومرحلة النمو."] : ["Distribute evenly around the root zone or between rows, then irrigate immediately.", "Do not dissolve it in the tank unless the label says it is fully water soluble.", "These are reference rates and vary by soil/water analysis, crop, and growth stage."],
      questions: language === "ar" ? ["ما نوع المحصول أو النبات؟"] : ["What crop or plant is this for?"],
    });
  }

  if (npk && greenhouse && area && soluble) {
    const min = (1 / 1000) * area;
    const max = (2 / 1000) * area;

    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "معدل NPK ذواب للبيوت المحمية" : "Water-soluble NPK greenhouse rate",
      summary: language === "ar" ? `لسماد NPK ذواب مع ماء الري في بيت محمي، المعدل الاسترشادي هو 1–2 كجم / 1000 م². لمساحة ${area} م² يكون المعدل التقريبي ${formatRange(min, max, "كجم")}.` : `For water-soluble NPK through irrigation in a greenhouse, the reference rate is 1–2 kg / 1000 m². For ${area} m², the approximate range is ${formatRange(min, max, "kg")}.`,
      advice: language === "ar" ? ["تأكد أن السماد مكتوب عليه ذواب بالكامل قبل وضعه في الخزان.", "قسّم الإضافة حسب البرنامج التسميدي بدل جرعة كبيرة واحدة عند الحاجة.", "هذه معدلات استرشادية وتختلف حسب تحليل التربة والمياه ونوع المحصول ومرحلة النمو."] : ["Make sure the label states it is fully water soluble before adding it to the tank.", "Split applications according to the fertilization program rather than one large dose when needed.", "These are reference rates and vary by soil/water analysis, crop, and growth stage."],
      questions: language === "ar" ? ["ما نوع المحصول ومرحلة النمو؟"] : ["What crop and growth stage is it?"],
    });
  }

  if (npk && greenhouse && area && liquid) {
    const min = (1 / 1000) * area;
    const max = (2 / 1000) * area;

    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "معدل NPK سائل للبيوت المحمية" : "Liquid NPK greenhouse rate",
      summary: language === "ar" ? `لسماد NPK سائل مع ماء الري في بيت محمي، المعدل الاسترشادي هو 1–2 لتر / 1000 م². لمساحة ${area} م² يكون المعدل التقريبي ${formatRange(min, max, "لتر")}.` : `For liquid NPK through irrigation in a greenhouse, the reference rate is 1–2 L / 1000 m². For ${area} m², the approximate range is ${formatRange(min, max, "L")}.`,
      advice: language === "ar" ? ["راجع كثافة السماد وتعليمات الملصق.", "لا تخلطه مع الكالسيوم أو مبيدات قبل التأكد من قابلية الخلط.", "المعدل استرشادي ويتغير حسب المحصول والتحليل."] : ["Check product density and label instructions.", "Do not mix it with calcium or pesticides before confirming compatibility.", "The rate is reference-based and changes by crop and analysis."],
      questions: language === "ar" ? ["ما نوع المحصول؟"] : ["What crop is it for?"],
    });
  }

  if (npk && !granular && !soluble && !liquid) {
    return makeFertilizerResponse({
      language,
      analysisSource,
      detectedProblem: language === "ar" ? "طريقة استخدام NPK غير محددة" : "Unspecified NPK use method",
      summary: language === "ar" ? "سماد NPK مثل 15-15-15 أو 20-20-20 لا يمكن تحديد معدله من التركيبة فقط. أهم فرق: هل هو ذواب مع ماء الري، سائل، أم محبب يُنثر على التربة؟" : "An NPK such as 15-15-15 or 20-20-20 cannot be rated from the formula alone. The key question is whether it is water-soluble, liquid, or granular broadcast fertilizer.",
      advice: language === "ar" ? ["لا تستخدم معدل السماد الذواب على سماد محبب، ولا العكس.", "اقرأ الملصق: طريقة الإضافة، وحدة القياس، ومعدل الاستخدام.", "المعدلات تختلف حسب المساحة والمحصول ومرحلة النمو وتحليل التربة والمياه."] : ["Do not use soluble fertilizer rates for granular fertilizer, or the reverse.", "Read the label: application method, unit, and rate.", "Rates vary by area, crop, growth stage, and soil/water analysis."],
      questions: language === "ar" ? ["هل السماد ذواب أم سائل أم محبب؟", "كم المساحة ونوع النبات؟"] : ["Is it water-soluble, liquid, or granular?", "What is the area and plant/crop?"],
      confidence: "medium",
    });
  }

  return null;
}

function buildFertilizerLabelResponse(params: {
  message: string;
  language: Language;
  analysisSource: "text" | "image" | "image_and_text";
}): JothrahChatResponse | null {
  const { language, analysisSource } = params;
  const text = normalizeFertilizerText(params.message);

  if (!isLabelQuestion(text) || !looksLikeFertilizerQuestion(text)) return null;

  return makeFertilizerResponse({
    language,
    analysisSource,
    detectedProblem: language === "ar" ? "بيانات ملصق السماد" : "Fertilizer label requirements",
    summary: language === "ar" ? "ملصق السماد يجب أن يوضح بيانات المنتج الأساسية حتى يستطيع العميل والمختص معرفة التركيبة وطريقة الاستخدام وقابلية الخلط والسلامة." : "A fertilizer label should show the core product data so the customer and specialist can understand composition, use rate, compatibility, and safety.",
    advice: language === "ar" ? ["أهم البيانات: الاسم التجاري، تركيز العناصر، وحدة القياس وزن/حجم أو وزن/وزن، مصدر العناصر، pH، والكثافة للسوائل والمعلقات والمعجون.", "يلزم ذكر طريقة ومعدل الإضافة، قابلية الخلط، التخزين، وزن أو حجم العبوة، بلد المنشأ، المنتج، المستورد، وتاريخ الإنتاج والانتهاء ورقم الدفعة.", "يلزم وجود علامات الأمن والسلامة وخانة رقم التسجيل، مع توافق بيانات الملصق العربي والإنجليزي عند وجودهما."] : ["Key data: trade name, nutrient concentrations, unit basis w/v or w/w, nutrient sources, pH, and density for liquids/suspensions/pastes.", "It should include application method/rate, compatibility, storage, pack size, origin, producer, importer, production/expiry date, and batch number.", "Safety symbols and registration number should be present, with Arabic/English label consistency when both exist."],
    questions: language === "ar" ? ["هل تريد صياغة ملصق لمنتج معين أم مراجعة ملصق جاهز؟"] : ["Do you want to draft a label for a product or review an existing label?"],
  });
}

function buildRouteDeterministicFertilizerResponse(params: {
  message: string;
  recentContext: string;
  language: Language;
  analysisSource: "text" | "image" | "image_and_text";
  forceWhatsapp: boolean;
}): JothrahChatResponse | null {
  const text = normalizeFertilizerText(`${params.recentContext}\n${params.message}`);

  if (!looksLikeFertilizerQuestion(text)) return null;

  const mixing = buildFertilizerMixingResponse(params);
  if (mixing) return mixing;

  const ph = buildFertilizerPhResponse(params);
  if (ph) return ph;

  const rate = buildFertilizerRateResponse(params);
  if (rate) return rate;

  const label = buildFertilizerLabelResponse(params);
  if (label) return label;

  return null;
}

const responseSchema = {
  name: "jothrah_chat_response",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      language: { type: "string", enum: ["ar", "en"] },
      analysis_source: {
        type: "string",
        enum: ["text", "image", "image_and_text"],
      },
      detected_problem: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      summary: { type: "string" },
      advice: {
        type: "array",
        items: { type: "string" },
        maxItems: 3,
      },
      questions: {
        type: "array",
        items: { type: "string" },
        maxItems: 2,
      },
      categories: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            url: { type: "string" },
          },
          required: ["title", "url"],
        },
        maxItems: 3,
      },
      product_suggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            url: { type: "string" },
            reason: { type: "string" },
          },
          required: ["name", "url", "reason"],
        },
        maxItems: 3,
      },
      whatsapp_needed: { type: "boolean" },
      whatsapp_message: { type: "string" },
    },
    required: [
      "language",
      "analysis_source",
      "detected_problem",
      "confidence",
      "summary",
      "advice",
      "questions",
      "categories",
      "product_suggestions",
      "whatsapp_needed",
      "whatsapp_message",
    ],
  },
  strict: true,
} as const;


function isHumanHandoffStatus(status: unknown) {
  const value = String(status || "");
  return value === "needs_human" || value === "human_replied" || value === "closed";
}

function isHumanRequestMessage(message: string) {
  const text = normalizeText(message);
  if (!text) return false;

  const terms = [
    "تواصل مع مختص",
    "طلب مختص",
    "مختص جذره",
    "مختص جذرة",
    "موظف",
    "خدمة العملاء",
    "انسان",
    "إنسان",
    "human support",
    "specialist",
    "agent"
  ];

  return terms.some((term) => text.includes(normalizeText(term)));
}

async function readRequestBody(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  let message = "";
  let languageFromClient: Language | null = null;
  let imageDataUrl: string | null = null;
  let visitorId = "";
  let pageUrl = "";
  let customerName = "";
  let customerPhone = "";
  let customerEmail = "";
  let customerKey = "";
  let requestHuman = false;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();

    message = String(form.get("message") || "").trim();
    languageFromClient = normalizeLanguage(form.get("language"), "ar");
    visitorId = String(form.get("visitor_id") || "").trim();
    pageUrl = String(form.get("page_url") || "").trim();
    customerName = String(form.get("customer_name") || "").trim();
    customerPhone = String(form.get("customer_phone") || "").trim();
    customerEmail = String(form.get("customer_email") || "").trim();
    customerKey = String(form.get("customer_key") || form.get("customer_id") || "").trim();
    requestHuman = String(form.get("request_type") || form.get("action") || "").toLowerCase().includes("human") || String(form.get("needs_human") || "").toLowerCase() === "true";

    const image = form.get("image");

    if (image instanceof File && image.size > 0) {
      if (!image.type || !isAllowedImageType(image.type)) {
        throw new Error("INVALID_IMAGE_TYPE");
      }

      if (image.size > MAX_IMAGE_SIZE) {
        throw new Error("IMAGE_TOO_LARGE");
      }

      imageDataUrl = await imageFileToDataUrl(image);
    }
  } else {
    const body = await req.json();

    message = String(body.message || "").trim();
    languageFromClient = normalizeLanguage(body.language, "ar");
    visitorId = String(body.visitor_id || body.visitorId || "").trim();
    pageUrl = String(body.page_url || body.pageUrl || "").trim();
    customerName = String(body.customer_name || body.customerName || "").trim();
    customerPhone = String(body.customer_phone || body.customerPhone || "").trim();
    customerEmail = String(body.customer_email || body.customerEmail || "").trim();
    customerKey = String(body.customer_key || body.customerKey || body.customer_id || body.customerId || "").trim();
    requestHuman = Boolean(body.needs_human || body.needsHuman) || String(body.request_type || body.action || "").toLowerCase().includes("human");

    const rawImage =
      typeof body.image === "string"
        ? body.image
        : typeof body.image_data_url === "string"
          ? body.image_data_url
          : "";

    if (rawImage) {
      if (
        !rawImage.startsWith("data:image/") &&
        !rawImage.startsWith("https://") &&
        !rawImage.startsWith("http://")
      ) {
        throw new Error("INVALID_IMAGE_TYPE");
      }

      imageDataUrl = rawImage;
    }
  }

  return {
    message,
    languageFromClient,
    imageDataUrl,
    visitorId,
    pageUrl,
    customerName,
    customerPhone,
    customerEmail,
    customerKey,
    requestHuman,
  };
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const {
      message,
      languageFromClient,
      imageDataUrl,
      visitorId,
      pageUrl,
      customerName,
      customerPhone,
      customerEmail,
      customerKey,
      requestHuman,
    } = await readRequestBody(req);

    const safeCustomerKey = String(customerKey || "").replace(/[^a-zA-Z0-9_\-:.]/g, "").slice(0, 120);
    const safeVisitorId =
      safeCustomerKey ||
      visitorId ||
      `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const userAgent = req.headers.get("user-agent") || "";

    if (!message && !imageDataUrl) {
      const language = languageFromClient || "ar";

      return NextResponse.json(
        {
          error:
            language === "ar"
              ? "اكتب رسالة أو أرفق صورة."
              : "Please write a message or attach an image.",
        },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const detectedLanguageFromText = message ? detectLanguage(message) : null;

    const language: Language =
      detectedLanguageFromText === "en"
        ? "en"
        : detectedLanguageFromText === "ar"
          ? "ar"
          : languageFromClient || "ar";

    const shouldRequestHuman = requestHuman || isHumanRequestMessage(message);

    const conversation = await upsertConversation({
      visitorId: safeVisitorId,
      language,
      message,
      pageUrl,
      userAgent,
      needsHuman: shouldRequestHuman,
      customerName,
      customerPhone,
      customerEmail,
      customerKey: safeCustomerKey,
      metadata: {
        customerNameSource: customerName ? "salla_account" : "visitor",
        customerKey: safeCustomerKey || null,
        identityMode: safeCustomerKey ? "logged_customer" : "visitor",
      },
    });

    await saveChatEvent({
      conversationId: conversation.id,
      visitorId: safeVisitorId,
      eventName: "chat_request_received",
      eventData: {
        hasImage: Boolean(imageDataUrl),
        pageUrl,
      },
    });
    let storedImageUrl: string | null = null;
    let uploadedImage: {
      filePath: string;
      signedUrl: string | null;
      mime: string;
      size: number;
    } | null = null;

    if (imageDataUrl) {
      try {
        uploadedImage = await uploadChatImage({
          conversationId: conversation.id,
          imageDataUrl,
        });

        storedImageUrl = uploadedImage.signedUrl;
      } catch (error) {
        console.warn("Failed to upload chat image:", error);
      }
    }

    const customerMessageRecord = await saveChatMessage({
      conversationId: conversation.id,
      senderType: "customer",
      message:
        message ||
        (imageDataUrl
          ? language === "ar"
            ? "صورة مرفقة"
            : "Attached image"
          : ""),
      imageUrl: storedImageUrl,
      metadata: {
        hasImage: Boolean(imageDataUrl),
        pageUrl,
        customerKey: safeCustomerKey || null,
        identityMode: safeCustomerKey ? "logged_customer" : "visitor",
      },
    });

    if (uploadedImage?.signedUrl) {
      await saveChatAttachment({
        conversationId: conversation.id,
        messageId: customerMessageRecord.id,
        fileUrl: uploadedImage.signedUrl,
        fileType: uploadedImage.mime,
        fileName: uploadedImage.filePath,
        fileSize: uploadedImage.size,
      });
    }

    const currentStatus = String(conversation.status || "ai");

    if (shouldRequestHuman || isHumanHandoffStatus(currentStatus)) {
      if (shouldRequestHuman && currentStatus !== "needs_human") {
        await supabaseAdmin
          .from("chat_conversations")
          .update({
            status: "needs_human",
            needs_human: true,
            human_requested_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);
      }

      await saveChatEvent({
        conversationId: conversation.id,
        visitorId: safeVisitorId,
        eventName: shouldRequestHuman ? "human_support_requested" : "human_mode_message_saved",
        eventData: {
          status: shouldRequestHuman ? "needs_human" : currentStatus,
          hasImage: Boolean(imageDataUrl),
        },
      });

      return NextResponse.json(
        {
          mode: currentStatus === "closed" ? "closed" : "human_waiting",
          status: shouldRequestHuman ? "needs_human" : currentStatus,
          conversation_id: conversation.id,
          saved: true,
          language,
          summary:
            currentStatus === "closed"
              ? language === "ar"
                ? "تم إنهاء هذه المحادثة. افتح محادثة جديدة إذا احتجت مساعدة إضافية."
                : "This conversation is closed. Start a new chat if you need more help."
              : language === "ar"
                ? "تم استلام رسالتك، وسيقوم مختص جذرة بالرد عليك داخل هذه الدردشة."
                : "Your message was received. A Jothrah specialist will reply inside this chat.",
        },
        { headers: corsHeaders(origin) },
      );
    }

    const client = getOpenAIClient();

    const visionAnalysis = imageDataUrl
      ? await analyzeImageFirst({
          client,
          imageDataUrl,
          message,
          language,
        })
      : null;

    const recentChatContext = await loadRecentConversationContext(
      conversation.id,
      language,
    );

    const matchingText = [
      recentChatContext,
      message,
      visionAnalysis?.detected_problem || "",
      visionAnalysis?.visual_notes || "",
      ...(visionAnalysis?.possible_category_terms || []),
    ]
      .filter(Boolean)
      .join(" ");

    const matchedCategories = matchCategories(
      matchingText || message,
      language,
    ) as ChatCategory[];

    const knowledgeHits = selectKnowledgeFiles(
      matchingText || message,
      matchedCategories,
    );

    const knowledgeContext = await buildKnowledgeContext(
      knowledgeHits,
      language,
    );

    const fertilizerMode = isFertilizerKnowledgeHit(knowledgeHits);
    const forceWhatsappByFertilizerSelection =
      fertilizerMode && isFertilizerProductSelectionRequest(message);

    const forceWhatsappByText = needsWhatsapp(message);
    const forceWhatsappByVision = shouldForceWhatsappFromVision(visionAnalysis);
    const forceWhatsapp =
      forceWhatsappByText ||
      forceWhatsappByVision ||
      forceWhatsappByFertilizerSelection;

    const visionContext = buildVisionContext(
      imageDataUrl,
      visionAnalysis,
      language,
    );

    const analysisSource = imageDataUrl
      ? message
        ? "image_and_text"
        : "image"
      : "text";

    const userPrompt =
      language === "ar"
        ? `
رسالة العميل:
${message || "لم يكتب العميل رسالة، أرسل صورة فقط."}

آخر سياق من نفس المحادثة:
${recentChatContext || "لا يوجد سياق سابق."}

مصدر التحليل:
${analysisSource}

نتيجة تحليل الصورة الأولية:
${visionContext}

التصنيفات المطابقة من المتجر:
${JSON.stringify(matchedCategories, null, 2)}

ملفات المعرفة المطابقة:
${JSON.stringify(
  knowledgeHits.map((hit) => ({
    id: hit.id,
    file: hit.file,
    score: hit.score,
  })),
  null,
  2,
)}

سياق المعرفة:
${knowledgeContext}

هل يجب التحويل إلى واتساب؟
${forceWhatsapp}

وضع الأسمدة العام:
${fertilizerMode}

أجب للعميل بصيغة مختصرة ومفيدة داخل شات متجر إلكتروني.
`
        : `
Customer message:
${message || "The customer did not write a message and only sent an image."}

Recent context from the same chat:
${recentChatContext || "No previous context."}

Analysis source:
${analysisSource}

Initial image analysis:
${visionContext}

Matched store categories:
${JSON.stringify(matchedCategories, null, 2)}

Matched knowledge files:
${JSON.stringify(
  knowledgeHits.map((hit) => ({
    id: hit.id,
    file: hit.file,
    score: hit.score,
  })),
  null,
  2,
)}

Knowledge context:
${knowledgeContext}

Should WhatsApp escalation be enabled?
${forceWhatsapp}

General fertilizer mode:
${fertilizerMode}

Reply in a short, useful ecommerce chat style.
`;

    const deterministicFertilizerResponse =
      buildRouteDeterministicFertilizerResponse({
        message,
        recentContext: recentChatContext,
        language,
        analysisSource,
        forceWhatsapp: forceWhatsappByFertilizerSelection,
      }) ||
      buildExternalDeterministicFertilizerResponse({
        message,
        recentContext: recentChatContext,
        language,
        analysisSource,
        forceWhatsapp: forceWhatsappByFertilizerSelection,
      });

    const effectiveFertilizerMode = fertilizerMode || Boolean(deterministicFertilizerResponse);

    let data: any = deterministicFertilizerResponse;

    if (!data) {
      const completion = await client.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: "system",
            content: jothrahSystemPrompt,
          },
          {
            role: "system",
            content: `
Important Jothrah response rules:
- The image analysis, if available, was performed first.
- Use the image analysis result, the customer text, recent chat context, matched categories, and knowledge context.
- Do not claim certainty from an unclear image.
- If confidence is low, image is unclear, or the case needs direct diagnosis, set whatsapp_needed to true.
- Do not invent pesticide dosage, dilution, mixing ratios, or safety claims.
- Do not recommend a specific product unless the product exists in provided knowledge or matched category data.
- If fertilizerMode is true or matched knowledge files are under data/knowledge/fertilizers, do not recommend product names, do not add product links, and keep product_suggestions empty.
- In fertilizer mode, calculate fertilizer rates only when the unit and application method are clear; otherwise ask one focused follow-up question.
- In fertilizer mode, if the customer asks what product to buy, set whatsapp_needed to true and invite them to contact a Jothrah specialist.
- In fertilizer follow-up messages, use the recent chat context. Example: if the customer first asks about NPK dose and then replies "خيار", treat it as the crop type and complete the calculation.
- product_suggestions may be an empty array.
- Keep advice to maximum 3 items.
- Keep questions to maximum 2 items.
- Return only valid JSON matching the schema.
`,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: responseSchema,
        },
        max_completion_tokens: 1000,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      data = JSON.parse(raw);
    }

    if (effectiveFertilizerMode) {
      data.product_suggestions = [];

      if (forceWhatsappByFertilizerSelection) {
        data.whatsapp_needed = true;
      }
    }

    await saveChatMessage({
      conversationId: conversation.id,
      senderType: "ai",
      message: buildStoredAiMessage(data, language),
      aiDetectedProblem: data.detected_problem || null,
      aiConfidence: data.confidence || null,
      aiWhatsappNeeded: Boolean(data.whatsapp_needed || forceWhatsapp),
      metadata: {
        fullResponse: data,
        categories: data.categories || matchedCategories,
        productSuggestions: data.product_suggestions || [],
        analysisSource,
      },
    });

    await saveChatEvent({
      conversationId: conversation.id,
      visitorId: safeVisitorId,
      eventName: "ai_response_created",
      eventData: {
        whatsappNeeded: Boolean(data.whatsapp_needed || forceWhatsapp),
        detectedProblem: data.detected_problem || "",
        confidence: data.confidence || "",
        analysisSource,
      },
    });

    const fallbackWhatsappMessage =
      language === "ar"
        ? `السلام عليكم، أحتاج مساعدة في تشخيص المشكلة. ${
            message ? `الرسالة: ${message}` : "أرسلت صورة فقط."
          }`
        : `Hello, I need help diagnosing the issue. ${
            message ? `Message: ${message}` : "I sent an image only."
          }`;

    const whatsappMessage =
      data.whatsapp_message && String(data.whatsapp_message).trim()
        ? data.whatsapp_message
        : fallbackWhatsappMessage;

    return NextResponse.json(
      {
        ...data,
        conversation_id: conversation.id,
        visitor_id: safeVisitorId,
        customer_name: customerName || conversation.customer_name || "",
        language,
        analysis_source: data.analysis_source || analysisSource,
        categories:
          Array.isArray(data.categories) && data.categories.length
            ? data.categories
            : matchedCategories,
        whatsapp_needed: Boolean(data.whatsapp_needed || forceWhatsapp),
        whatsapp_url: buildWhatsappUrl(whatsappMessage),
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error(error);

    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (message === "INVALID_IMAGE_TYPE") {
      return NextResponse.json(
        { error: "Invalid image type" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    if (message === "IMAGE_TOO_LARGE") {
      return NextResponse.json(
        { error: "Image is too large. Maximum size is 4MB." },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

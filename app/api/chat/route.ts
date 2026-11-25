import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse, after } from "next/server";
import OpenAI from "openai";

import { jothrahSystemPrompt } from "@/lib/jothrah-system-prompt";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { detectLanguage, matchCategories } from "@/lib/matcher";
import { needsWhatsapp } from "@/lib/safety";
import { sendAdminPushNotification } from "@/lib/admin-push";
import { buildCatalogIndex, hydrateProductSuggestions, alignAdviceWithProducts, getProductById, productType } from "@/lib/products";
import { recommendFromGuide, namedProductRate, mentionedCatalogNos, searchGuide, formatGuideEntries, listsContext, fertilizerKnowledgeContext, fertilizerRateHint } from "@/lib/guide";
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
  crop?: string;
  pest_or_disease?: string;
};


function trimPushText(value: unknown, max = 120) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function getPushCustomerLabel(...values: unknown[]) {
  for (const value of values) {
    const text = trimPushText(value, 60);
    if (text) return text;
  }

  return "زائر بدون اسم";
}

async function notifyAdminNewCustomerMessage(params: {
  conversationId: string;
  message?: string;
  hasImage?: boolean;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  isHumanRequest?: boolean;
  currentStatus?: string;
}) {
  try {
    const customerLabel = getPushCustomerLabel(
      params.customerName,
      params.customerPhone,
      params.customerEmail,
    );

    const preview =
      trimPushText(params.message, 110) ||
      (params.hasImage ? "أرسل العميل صورة مرفقة." : "وصلت رسالة جديدة.");

    const title = params.isHumanRequest
      ? "طلب مختص جديد في جذرة"
      : params.currentStatus === "needs_human" || params.currentStatus === "human_replied"
        ? "رسالة جديدة داخل محادثة مختص"
        : "رسالة جديدة من عميل جذرة";

    await sendAdminPushNotification({
      title,
      body: `${customerLabel}: ${preview}`,
      url: `/admin/conversations?id=${encodeURIComponent(params.conversationId)}`,
    });
  } catch (error) {
    console.error("Admin push notification failed:", error);
  }
}

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
    origin && (allowedOrigins.includes(origin) || /^https:\/\/([a-z0-9-]+\.)?jothrah\.com$/i.test(origin))
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
    .slice(0, 2);
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
  const fullPath = path.join(process.cwd(), "data", "knowledge", relativeFile);

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

    return `Knowledge file: data/knowledge/${relativeFile}\n${content}`;
  } catch (error) {
    console.warn(`Knowledge file not loaded: ${relativeFile}`, error);
    return null;
  }
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
    crop: "",
    pest_or_disease: "",
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
- هل هي حشرة منزلية؟ آفة نباتية؟ مرض نبات؟ أثر قارض؟ أم غير واضح؟
- لا تجزم إذا الصورة غير واضحة.
- لا تعطي جرعات مبيدات.
- crop: اسم النبات/المحصول الظاهر بالعربي كما يسميه المزارع في السعودية (مثل: الطماطم، الخيار، النخيل، الفلفل، العنب)، أو "" إذا ما يظهر نبات أو غير متأكد.
- pest_or_disease: الاسم العربي الشائع للآفة أو المرض الأرجح (مثل: المن، الذبابة البيضاء، التربس، العناكب، صانعات الأنفاق، البياض الدقيقي، البياض الزغبي، العفن الرمادي، اللفحة المتأخرة، سوسة النخيل الحمراء)، أو "" إذا غير واضح. لا تخمّن اسماً إذا الثقة منخفضة.
- إذا كانت الصورة غير واضحة أو الحالة خطرة أو تحتاج تشخيص مباشر، اجعل whatsapp_needed = true.

رسالة العميل:
${message || "لا توجد رسالة، الصورة فقط."}

أعد JSON فقط.
`
      : `
Analyze the image as an initial public-health and agricultural pest assistant for Jothrah.

Required:
- Identify what appears in the image if possible.
- Is it a household insect, plant pest, plant disease, rodent sign, or unclear?
- Do not be overconfident if the image is unclear.
- Do not provide pesticide dosage.
- crop: the plant/crop shown, in Arabic (e.g. الطماطم، الخيار، النخيل), or "" if none/unsure.
- pest_or_disease: the most likely pest or disease, common Arabic name (e.g. المن، الذبابة البيضاء، البياض الدقيقي), or "" if unclear. Do not guess when confidence is low.
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
              crop: {
                type: "string",
              },
              pest_or_disease: {
                type: "string",
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
              "crop",
              "pest_or_disease",
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
        maxItems: 2,
      },
      questions: {
        type: "array",
        items: { type: "string" },
        maxItems: 1,
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
            id: { type: "string" },
            reason: { type: "string" },
          },
          required: ["id", "reason"],
        },
        maxItems: 4,
      },
      whatsapp_needed: { type: "boolean" },
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

// أمور التسجيل الرسمية خارج نطاق خدمة العملاء: اشتراطات، أرقام تسجيل، مختبرات محايدة، تفاويض، تعهدات، وثائق
const DEEP_RE = /اشتراطات|اشراطات|شروط (ال)?تسجيل|متطلبات (ال)?تسجيل|تسجيل (ال)?(سماد|اسمده|مبيد|مبيدات|منتج|منتجات|شركه|مصنع)|(رقم|ارقام) (ال)?تسجيل|شهاده (ال)?تسجيل|مختبر(ات)? (محايد|معتمد)|تفويض|تفاويض|تعهد|تعهدات|شهاده (بيع حر|حره|التحليل)|free ?sale|\bcoa\b|\bmsds\b|registration/i;
function normalizeArabicLite(v: string) {
  return String(v || "").replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const wantStream = req.nextUrl.searchParams.get("stream") === "1";
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const mark = (k: string) => { timings[k] = Date.now() - t0; };

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

    mark("parsed");
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

    after(() => saveChatEvent({
      conversationId: conversation.id,
      visitorId: safeVisitorId,
      eventName: "chat_request_received",
      eventData: {
        hasImage: Boolean(imageDataUrl),
        pageUrl,
      },
    }).catch(() => {}));
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

    mark("conversation");
    const historyPromise = supabaseAdmin
      .from("chat_messages")
      .select("sender_type, message, created_at")
      .eq("conversation_id", conversation.id)
      .eq("visible_to_customer", true)
      .in("sender_type", ["customer", "ai", "human"])
      .order("created_at", { ascending: false })
      .limit(11)
      .then((r: any) => r, () => ({ data: [] as any[] }));

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

    after(() => notifyAdminNewCustomerMessage({
      conversationId: conversation.id,
      message,
      hasImage: Boolean(imageDataUrl),
      customerName: customerName || conversation.customer_name || "",
      customerPhone: customerPhone || conversation.customer_phone || "",
      customerEmail: customerEmail || conversation.customer_email || "",
      isHumanRequest: shouldRequestHuman,
      currentStatus,
    }));

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

    const matchingText = [
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

    const forceWhatsappByText = needsWhatsapp(message);
    const forceWhatsappByVision = shouldForceWhatsappFromVision(visionAnalysis);
    const forceWhatsapp = forceWhatsappByText || forceWhatsappByVision;

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

أجب للعميل بصيغة مختصرة ومفيدة داخل شات متجر إلكتروني، وبأسلوب ودود تفاعلي، واختم بسؤال متابعة قصير يساعدك تفهم حالته أكثر.
مهم جداً: اكتب كل النصوص بنفس لغة رسالة العميل أعلاه.
مهم: إذا كانت المشكلة أو الطلب له منتج مناسب في كتالوج جذرة فرشّح 1 إلى 4 منتجات في product_suggestions بالمعرّف، ولا تكتفي بذكر التصنيف.
`
        : `
Customer message:
${message || "The customer did not write a message and only sent an image."}

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

Reply in a short, friendly, interactive ecommerce chat style and end with one short follow-up question.
VERY IMPORTANT: write summary, advice, questions and product reasons in the exact same language as the customer message above (German message → German reply, Urdu → Urdu, English → English).
IMPORTANT: if a fitting product exists in the Jothrah catalog, put 1–4 of them in product_suggestions by their catalog line number instead of only naming a category.
`;

    const { data: historyRowsRaw } = await historyPromise;
    mark("history");
    const historyRows = ((historyRowsRaw || []) as any[]).filter((row: any) => row.message);
    // الاستعلام قد يرجع رسالة العميل الحالية (لو انحفظت قبله) — نشيلها حتى لا تتكرر
    if (historyRows[0] && historyRows[0].sender_type === "customer" && String(historyRows[0].message).trim() === String(message).trim()) historyRows.shift();
    else if (historyRows.length > 10) historyRows.pop();

    const historyText = historyRows
      .reverse()
      .map((row: any) =>
        `${row.sender_type === "customer" ? "العميل" : row.sender_type === "human" ? "مختص جذرة" : "المساعد"}: ${String(row.message).slice(0, 400)}`,
      )
      .join("\n");

    // المراجع الموسعة: دليل المبيدات السعودي 1446 + القوائم المقيدة/المحظورة + معرفة الأسمدة ومتطلبات تسجيلها
    const guideQuery = `${message} ${visionAnalysis?.pest_or_disease || ""} ${visionAnalysis?.crop ? `على ${visionAnalysis.crop}` : ""} ${visionAnalysis?.detected_problem || ""} ${(visionAnalysis?.possible_category_terms || []).join(" ")}`;
    const guideText = formatGuideEntries(searchGuide(guideQuery, 4), message);
    const legalText = listsContext(message);
    // اشتراطات التسجيل والوثائق الرسمية ليست من خدمة العميل — لا تُضاف للبوت
    const fertText = fertilizerKnowledgeContext(message);
    const rateHint = fertilizerRateHint(message);
    const fertRegText = "";
    const referenceBlock = [
      guideText ? `من دليل المبيدات الزراعية في المملكة العربية السعودية (1446هـ) — مواد فعالة مسجلة مطابقة للسؤال:\n${guideText}` : "",
      legalText ? `من دليل المبيدات 1446 — المبيدات المقيدة والمحظورة:\n${legalText}` : "",
      rateHint ? `المعدل المعتمد لهذا السؤال (استخدم هذه الأرقام حرفياً، صلب = كجم، سائل = لتر):\n${rateHint}` : "",
      fertText ? `معرفة جذرة في الأسمدة (معدلات استرشادية):\n${fertText}` : "",
      fertRegText ? `متطلبات تسجيل الأسمدة ومحسنات التربة في المملكة (منصة نما / الشركة الوطنية للخدمات الزراعية):\n${fertRegText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model: getModel(),
      messages: [
        {
          role: "system",
          content: jothrahSystemPrompt,
        },
        {
          role: "system",
          content: `
Jothrah product catalog (every product currently available in the store).
Format per line: number|[product type]|name|active ingredient (names include size and target pests). Use the line number as the product id.
Only suggest products whose [type] matches the need: fertilizer question → [سماد] only; pest → the matching مبيد type; never suggest [بذور] unless the customer asks for seeds.
${buildCatalogIndex()}

Product rules:
- product_suggestions[].id must be the line number of the product in this catalog (e.g. "57"), and the product name must truly match the need.
- Suggest 1 to 4 products that truly fit the customer's need (pest, crop, seed type, fertilizer need). If the customer names a product type that exists (e.g. eggplant / aubergine / باذنجان seeds), suggest those products.
- If nothing in the catalog fits, return an empty array and say so honestly — never invent products.
- Each reason: one short line in the customer's language explaining why it fits.
- Do not write product URLs or prices in the summary; the store shows product cards automatically.
`,
        },
        {
          role: "system",
          content: `
Important Jothrah response rules:
- The image analysis, if available, was performed first.
- Use the image analysis result, the customer text, matched categories, and knowledge context.
- Do not claim certainty from an unclear image.
- If confidence is low, image is unclear, or the case needs direct diagnosis, set whatsapp_needed to true.
- Do not invent pesticide dosage, dilution, mixing ratios, or safety claims.
- Only recommend products from the provided catalog, by catalog line number.
- product_suggestions may be an empty array.
- Keep advice to maximum 3 items.
- Keep questions to maximum 2 items.
- Return only valid JSON matching the schema.
- SPEED: be brief. summary max 35 words, each advice max 12 words, each product reason max 8 words, categories may be [] when products are suggested.
`,
        },
        {
          role: "system",
          content: `
Order / shipping / payment questions:
- You cannot see orders. Never tell the customer to "contact customer service via the order number".
- Instead say briefly: they can type their order number here (the chat shows their order details automatically when logged in), or tap the "تواصل مع خدمة العملاء" button below to reach the Jothrah team inside this chat.

Language rule (overrides earlier language rules):
- Write summary, advice, questions and reasons in the SAME language as the customer's latest message, whatever it is (Arabic, English, German, Urdu, Hindi, ...).
- The "language" field must be "ar" only when replying in Arabic, otherwise "en".
- Arabic replies use clear Saudi-friendly Modern Standard Arabic.
- Be warm and human, start directly with the answer (no "As an AI").

Official references (use them as the source of truth when relevant):
${referenceBlock || "(none for this question)"}

Reference rules:
- Never mention the source of the references to the customer: do not write "دليل المبيدات" or "حسب الدليل" or "حسب الوزارة" or any similar phrase. State the information directly as fact.
- If the references contain a line starting with "الحكم الصحيح", state that verdict exactly (restricted is NOT banned). Otherwise, if the customer asks whether an active ingredient is banned or restricted and you cannot find it in the lists, say it is not listed as banned/restricted in the guide.
- When registered uses from the guide match the customer's crop and pest, name 1-3 of those active ingredients in the advice.
- If you suggest products, any active ingredient you name in the advice must be the active ingredient of one of the suggested products (or from the guide for that exact crop and pest). Never suggest a fungicide for insects or an insecticide for a fungal disease, and never a public-health product for a crop.
- Never recommend a banned active ingredient. For restricted ones, say they are used only with approval/supervision of the competent authority.
- Prefer recommending store products whose active ingredient is registered for the customer's crop and pest in the guide.
- Usage questions (how/when to use, registered crops and pests, mixing, fertilizer guidance rates) are allowed, but give numbers ONLY if they appear in the provided references or product data; never invent or convert a rate.
- Pesticide rates and pre-harvest intervals: when the guide references list a row for the customer's crop and pest, give the rate (المعدل) and the pre-harvest interval (فترة التحريم) exactly as written (without naming any source), and add that the product label is the final reference. If the customer named a store product, use ONLY an entry marked ✅ for that product; if none is marked ✅ (or it is marked ⚠️), say the rate of that exact product is on its label and do not quote another concentration's rate. If the crop is not in the listed rows, say it is not registered for that crop. If the customer asks per liter (لكل لتر) and the rate is per 100 or 1000 liters, also give the per-liter amount (divide carefully: 50-80 جم/100 لتر = 0.5-0.8 جم/لتر). If the customer did not mention the crop and the rate differs by crop, ask which crop. If the crop is unknown and the pre-harvest interval differs between crop rows, list each crop group's interval briefly (e.g. "الخضروات 3 أيام، أشجار الفاكهة 14 يوم") instead of one number.
- Recommendation format (apply to every question like "عندي <آفة/مرض> على <محصول> وش أستخدم"، when the customer does NOT name a product): choose a guide entry marked 🛒 whose listed row contains the customer's crop and pest/disease (prefer the first such entry). Write the summary exactly in this shape: "لـ<الآفة> على <المحصول> تقدر تستخدم <المادة الفعالة بالعربي> <التركيز>% (<الاسم التجاري للمنتج>)." Then advice lines, in order: "المعدل: <rate as written>"، "فترة التحريم: <PHI as written> قبل الحصاد" (if the row has an application note instead of a PHI, write that note as written)، "الالتزام بملصق المنتج.". Put that product first in product_suggestions using its catalog number. If another 🛒 entry with a DIFFERENT active ingredient also has a row for the same crop and pest, add one more advice line: "بديل: <المادة بالعربي> <التركيز>% (<المنتج>) — المعدل <rate>، فترة التحريم <PHI>" and suggest that product second. If no 🛒 entry has a row for that crop and pest, use the same format with the active ingredient from a matching row (no product name) and say it is not available in the store right now. Never write generic advice like "استخدم مبيد حشري مناسب".
- When giving fertilizer guidance rates, pick the row of the correct crop category exactly: vegetables (خضار) = tomato, cucumber, pepper, eggplant, squash/zucchini, potato, onion, garlic, cabbage, lettuce, melon, watermelon, strawberry; fruit (فاكهة) = palms/dates, citrus, grapes, mango, fig, pomegranate, olive, apple; field crops (حقلية) = wheat, barley, corn, alfalfa/forage; greenhouse (بيوت محمية) when the customer says greenhouse. If irrigation vs foliar or field vs greenhouse is not stated, state which case your number is for. Always end with: "المعدلات استرشادية وتختلف حسب تحليل التربة والمياه ومرحلة النمو، والالتزام بملصق المنتج أولاً."
- Registration matters are OUT OF SCOPE for customers: registration requirements/conditions for fertilizers or pesticides, registration numbers, neutral/accredited labs, authorization letters, pledges/undertakings, official documents (MSDS, COA, free-sale certificates). Do not answer them.

Previous messages in this conversation (oldest first), use them for context:
${historyText || "(none)"}
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
      max_completion_tokens: 650,
      temperature: 0.2,
    };

    const finalize = async (raw: string) => {
    const data = JSON.parse(raw || "{}");
    let productCards = hydrateProductSuggestions(data.product_suggestions, 4, message, historyText.slice(-300));
    data.product_suggestions = productCards.map((card) => ({
      id: card.id,
      name: card.name,
      url: card.url,
      reason: card.reason,
    }));
    data.products = productCards;
    if (DEEP_RE.test(normalizeArabicLite(message))) {
      data.summary = language !== "en"
        ? "عذراً، أمور التسجيل والوثائق الرسمية خارج نطاق خدمة متجر جذرة."
        : "Sorry, registration matters and official documents are outside Jothrah store support.";
      data.advice = [language !== "en" ? "نقدر نساعدك في تشخيص مشكلتك واختيار المنتج المناسب لها." : "We can help you diagnose your problem and choose the right product."];
      data.questions = [];
      data.product_suggestions = [];
      data.products = [];
      data.whatsapp_needed = false;
    }
    // توصية ثابتة الصيغة: "لـ<الآفة> على <المحصول> تقدر تستخدم <المادة> (<المنتج>)" + المعدل + فترة التحريم
    let reco = language !== "en" && !DEEP_RE.test(normalizeArabicLite(message)) ? recommendFromGuide(message) : null;
    // صورة: نبني التوصية من تشخيص الصورة (الآفة + المحصول) إذا الثقة ليست منخفضة
    const vPest = String(visionAnalysis?.pest_or_disease || "").trim();
    const vCrop = String(visionAnalysis?.crop || "").trim();
    if (!reco && language !== "en" && visionAnalysis && visionAnalysis.confidence !== "low" && visionAnalysis.image_clarity !== "unclear" && vPest && !mentionedCatalogNos(message).length) {
      const fromImage = recommendFromGuide(`عندي ${vPest}${vCrop ? ` على ${vCrop}` : ""}`);
      if (fromImage) {
        reco = {
          ...fromImage,
          summary: `التشخيص المبدئي من الصورة: ${vPest}${vCrop ? ` على ${vCrop}` : ""}${visionAnalysis.confidence === "medium" ? " (غير مؤكد)" : ""}. ${fromImage.summary}`,
        };
      }
    }
    // سؤال معدل/تحريم لمنتج مذكور بالاسم: الرد من صفحة الدليل المطابقة للمنتج مباشرة
    if (!reco && language !== "en" && !DEEP_RE.test(normalizeArabicLite(message))) {
      const nr = namedProductRate(message);
      if (nr) {
        data.summary = nr.summary;
        data.advice = nr.advice;
        data.questions = nr.askCrop ? ["على أي محصول تبي تستخدمه؟"] : [];
        reco = nr;
        const recoCards = hydrateProductSuggestions(nr.catalogNos.map((n) => ({ id: String(n), reason: "" })), 1, "", "");
        const t = recoCards[0] ? getProductById(recoCards[0].id) : null;
        productCards = [...recoCards, ...productCards.filter((c) => { const p = getProductById(c.id); return c.id !== recoCards[0]?.id && p && t && productType(p) === productType(t); })].slice(0, 4);
        data.product_suggestions = productCards.map((card) => ({ id: card.id, name: card.name, url: card.url, reason: card.reason }));
        data.products = productCards;
      }
    }
    // منتج مذكور بالاسم (بوستاك...): بطاقته أولاً، والبقية من نفس نوعه فقط (لا مبيد صحة عامة مع مبيد فطري)
    if (!reco) {
      const named = mentionedCatalogNos(message);
      if (named.length) {
        const namedCards = hydrateProductSuggestions(named.map((n) => ({ id: String(n), reason: "" })), named.length, "", "");
        const types = new Set(namedCards.map((c) => { const p = getProductById(c.id); return p ? productType(p) : ""; }));
        const ids = new Set(namedCards.map((c) => c.id));
        productCards = [
          ...namedCards,
          ...productCards.filter((c) => { const p = getProductById(c.id); return !ids.has(c.id) && p && types.has(productType(p)); }),
        ].slice(0, 4);
        data.product_suggestions = productCards.map((card) => ({ id: card.id, name: card.name, url: card.url, reason: card.reason }));
        data.products = productCards;
      }
    }
    if (reco) {
      const recoCards = reco.catalogNos.length ? hydrateProductSuggestions(reco.catalogNos.map((n) => ({ id: String(n), reason: "" })), reco.catalogNos.length, "", "") : [];
      const recoIds = new Set(recoCards.map((c) => c.id));
      productCards = [...recoCards, ...(recoCards.length ? productCards.filter((c) => !recoIds.has(c.id)) : [])].slice(0, 4);
      data.summary = reco.summary;
      data.advice = reco.advice;
      data.questions = [];
      data.product_suggestions = productCards.map((card) => ({ id: card.id, name: card.name, url: card.url, reason: card.reason }));
      data.products = productCards;
    }
    // لا نذكر مصدر المعلومة للعميل (دليل المبيدات / الوزارة)
    const stripSource = (t: string) => t
      .replace(/\s*[(（]?\s*(?:و?(?:حسب|بحسب|وفق|وفقا|وفقاً|طبقا|طبقاً|استنادا|استناداً|بناء|بناءً)\s*(?:ل|لما|إلى|الى|على|ما)?\s*(?:ورد|جاء|هو مذكور|مذكور)?\s*(?:في)?\s*)(?:ال)?دليل(?:\s+(?:المبيدات|الزراعية|الزراعي|في|المملكة|العربية|السعودية|الرسمي|الوزارة|\d{4}هـ?|[(]?1446هـ?[)]?))*\s*[)）]?/g, "")
      .replace(/\s*(?:و?(?:حسب|بحسب|وفق|وفقاً|وفقا))\s*(?:تعليمات\s*|توصيات\s*)?(?:ال)?وزار(?:ة|ه)(?:\s+(?:البيئة|والمياه|والزراعة))*/g, "")
      .replace(/\s+(?:في|من|ب)\s*(?:ال)?دليل(?:\s+(?:المبيدات|الزراعية|الزراعي|المملكة|العربية|السعودية))*/g, "")
      .replace(/\s+([.،,])/g, "$1");
    const clean = (v: unknown) => stripSource(String(v || "")).replace(/[",\s]+$/g, "").replace(/\s{2,}/g, " ").trim();
    if (typeof data.summary === "string") data.summary = clean(data.summary);
    if (Array.isArray(data.advice)) data.advice = data.advice.map(clean).filter(Boolean);
    // سؤال "لكل لتر": نحسب المعادل من المعدل المكتوب (جم أو مل لكل 100/1000 لتر)
    if (language !== "en" && /لكل لتر|للتر|باللتر|في اللتر|اللتر الواحد|لتر واحد/.test(message) && Array.isArray(data.advice)) {
      const all = [data.summary, ...data.advice].join(" ");
      const m = /(\d+(?:\.\d+)?)\s*(?:-|–|إلى|الى)?\s*(\d+(?:\.\d+)?)?\s*(جم|جرام|غرام|كجم|كيلو|مل|ملل|سم3|لتر)\s*(?:\/|لكل|ل)\s*(100|1000)\s*لتر/.exec(all);
      if (m && !/لكل لتر ماء|\/\s*لتر ماء(?!\S)/.test(data.advice.join(" "))) {
        const div = Number(m[4]);
        const big = /^(لتر|كجم|كيلو)$/.test(m[3]); // لتر/كجم ← مل/جم لكل لتر
        const f = (v: string) => String(Math.round(((Number(v) * (big ? 1000 : 1)) / div) * 1000) / 1000);
        const unit = /مل|ملل|سم3|لتر/.test(m[3]) ? "مل" : "جم";
        data.advice.splice(1, 0, `يعادل: ${f(m[1])}${m[2] ? `-${f(m[2])}` : ""} ${unit} لكل لتر ماء`);
      }
    }
    if (!reco) data.advice = alignAdviceWithProducts(data.advice, productCards, data.language === "en" ? "en" : "ar");
    await saveChatMessage({
      conversationId: conversation.id,
      senderType: "ai",
      message: data.summary || "",
      aiDetectedProblem: data.detected_problem || null,
      aiConfidence: data.confidence || null,
      aiWhatsappNeeded: Boolean(data.whatsapp_needed || forceWhatsapp),
      metadata: {
        fullResponse: data,
        categories: data.categories || matchedCategories,
        productSuggestions: data.product_suggestions || [],
        products: productCards,
        analysisSource,
      },
    });

    after(() => saveChatEvent({
      conversationId: conversation.id,
      visitorId: safeVisitorId,
      eventName: "ai_response_created",
      eventData: {
        whatsappNeeded: Boolean(data.whatsapp_needed || forceWhatsapp),
        detectedProblem: data.detected_problem || "",
        confidence: data.confidence || "",
        analysisSource,
      },
    }).catch(() => {}));

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

    mark("saved");
    return {
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
        whatsapp_needed: DEEP_RE.test(normalizeArabicLite(message)) ? false : Boolean(data.whatsapp_needed || forceWhatsapp),
        whatsapp_url: buildWhatsappUrl(whatsappMessage),
        server_timing: timings,
      };
    };

    // الأسئلة العميقة ما تُبث حتى لا يظهر للعميل أي نص قبل استبداله بالتحويل للمهندس
    if (!wantStream || DEEP_RE.test(normalizeArabicLite(message))) {
      const completion = await client.chat.completions.create(completionParams);
      mark("model");
      const payload = await finalize(completion.choices[0]?.message?.content || "{}");
      return NextResponse.json(payload, { headers: corsHeaders(origin) });
    }

    // بث الرد: يبدأ النص يظهر للعميل خلال ثانية بدل انتظار الرد كامل
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let raw = "";
        try {
          // حشوة 2KB حتى لا يحجز المتصفح أول البث (MIME sniffing في XHR)
          controller.enqueue(encoder.encode(" ".repeat(2048) + "\n"));
          const modelStream = await client.chat.completions.create({ ...completionParams, stream: true });
          let first = true;
          for await (const chunk of modelStream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (!delta) continue;
            if (first) { mark("first_token"); first = false; }
            raw += delta;
            controller.enqueue(encoder.encode(delta));
          }
          mark("model");
          const payload = await finalize(raw);
          controller.enqueue(encoder.encode("\n\u001eFINAL" + JSON.stringify(payload)));
        } catch (err) {
          console.error(err);
          controller.enqueue(encoder.encode("\n\u001eFINAL" + JSON.stringify({ error: "Failed to process chat request" })));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
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

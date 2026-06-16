import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { jothrahSystemPrompt } from "@/lib/jothrah-system-prompt";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { detectLanguage, matchCategories } from "@/lib/matcher";
import { needsWhatsapp } from "@/lib/safety";
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

أجب للعميل بصيغة مختصرة ومفيدة داخل شات متجر إلكتروني.
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

Reply in a short, useful ecommerce chat style.
`;

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
- Use the image analysis result, the customer text, matched categories, and knowledge context.
- Do not claim certainty from an unclear image.
- If confidence is low, image is unclear, or the case needs direct diagnosis, set whatsapp_needed to true.
- Do not invent pesticide dosage, dilution, mixing ratios, or safety claims.
- Do not recommend a specific product unless the product exists in provided knowledge or matched category data.
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
    const data = JSON.parse(raw);
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

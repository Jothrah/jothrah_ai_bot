import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { jothrahSystemPrompt } from "@/lib/jothrah-system-prompt";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import { detectLanguage, matchCategories } from "@/lib/matcher";
import { needsWhatsapp } from "@/lib/safety";

export const runtime = "nodejs";

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
      "cockroach control"
    ]
  },
  {
    id: "mosquitoes",
    file: "public-health/mosquitoes.json",
    terms: [
      "بعوض",
      "ناموس",
      "الناموس",
      "البعوض",
      "mosquito",
      "mosquitoes"
    ]
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
      "house flies"
    ]
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
      "white ants"
    ]
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
      "bedbugs"
    ]
  },
  {
    id: "ants",
    file: "public-health/ants.json",
    terms: [
      "نمل",
      "النمل",
      "ant",
      "ants"
    ]
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
      "rodents"
    ]
  },
  {
    id: "red-palm-weevil",
    file: "agriculture-pests/red-palm-weevil.json",
    terms: [
      "سوسة النخيل",
      "سوسة النخيل الحمراء",
      "النخيل",
      "red palm weevil",
      "palm weevil"
    ]
  },
  {
    id: "whiteflies",
    file: "agriculture-pests/whiteflies.json",
    terms: [
      "ذبابة بيضاء",
      "الذبابة البيضاء",
      "whitefly",
      "whiteflies",
      "white fly"
    ]
  },
  {
    id: "aphids",
    file: "agriculture-pests/aphids.json",
    terms: [
      "من",
      "المن",
      "حشرة المن",
      "aphid",
      "aphids"
    ]
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
      "spider mites"
    ]
  },
  {
    id: "mealybugs",
    file: "agriculture-pests/mealybugs.json",
    terms: [
      "بق دقيقي",
      "البق الدقيقي",
      "mealybug",
      "mealybugs"
    ]
  },
  {
    id: "powdery-mildew",
    file: "plant-diseases/powdery-mildew.json",
    terms: [
      "بياض دقيقي",
      "البياض الدقيقي",
      "powdery mildew"
    ]
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
      "leaf spots"
    ]
  },
  {
    id: "root-rot",
    file: "plant-diseases/root-rot.json",
    terms: [
      "عفن جذور",
      "تعفن الجذور",
      "root rot"
    ]
  },
  {
    id: "yellowing",
    file: "nutrition/yellowing.json",
    terms: [
      "اصفرار",
      "اصفرار الأوراق",
      "اصفرار الورق",
      "yellowing",
      "yellow leaves"
    ]
  },
  {
    id: "iron-deficiency",
    file: "nutrition/iron-deficiency.json",
    terms: [
      "نقص الحديد",
      "حديد",
      "iron deficiency",
      "iron"
    ]
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
      "fertilizers"
    ]
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
      "planting season"
    ]
  }
];

function corsHeaders(origin?: string | null) {
  const rawAllowedOrigins =
    process.env.ALLOWED_ORIGIN || "https://jothrah.com";

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
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json(
    {},
    { headers: corsHeaders(req.headers.get("origin")) }
  );
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({ apiKey });
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
  categories: ChatCategory[]
) {
  const haystack = normalizeText(
    [
      message,
      ...categories.map((category) => category.title || "")
    ].join(" ")
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
  categories: ChatCategory[]
): KnowledgeHit[] {
  return KNOWLEDGE_RULES
    .map((rule) => ({
      ...rule,
      score: scoreKnowledgeRule(rule, message, categories)
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
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function collectKnowledgeText(
  value: unknown,
  language: Language,
  lines: string[],
  keyPath = "",
  depth = 0
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

      collectKnowledgeText(
        childValue,
        language,
        lines,
        nextKeyPath,
        depth + 1
      );

      if (lines.length >= 80) break;
    }
  }
}

async function readKnowledgeFile(
  relativeFile: string,
  language: Language
): Promise<string | null> {
  const fullPath = path.join(
    process.cwd(),
    "data",
    "knowledge",
    relativeFile
  );

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

async function buildKnowledgeContext(
  hits: KnowledgeHit[],
  language: Language
) {
  if (!hits.length) {
    return language === "ar"
      ? "لم يتم العثور على ملف معرفة تفصيلي مطابق. استخدم الإرشادات العامة فقط ولا تخترع تفاصيل."
      : "No matching detailed knowledge file was found. Use general guidance only and do not invent details.";
  }

  const loadedFiles = await Promise.all(
    hits.map((hit) => readKnowledgeFile(hit.file, language))
  );

  const context = loadedFiles.filter(Boolean).join("\n\n---\n\n");

  if (!context.trim()) {
    return language === "ar"
      ? "تمت مطابقة المشكلة، لكن ملفات المعرفة لم تُقرأ من الخادم. استخدم الإرشادات العامة فقط ولا تخترع تفاصيل."
      : "The issue was matched, but knowledge files could not be read from the server. Use general guidance only and do not invent details.";
  }

  return context;
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

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json();
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const detectedLanguage = detectLanguage(message);
    const language: Language = detectedLanguage === "en" ? "en" : "ar";

    const matchedCategories = matchCategories(
      message,
      language
    ) as ChatCategory[];

    const forceWhatsapp = needsWhatsapp(message);

    const knowledgeHits = selectKnowledgeFiles(message, matchedCategories);
    const knowledgeContext = await buildKnowledgeContext(
      knowledgeHits,
      language
    );

    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: jothrahSystemPrompt
        },
        {
          role: "system",
          content: `
Jothrah matched categories:
${JSON.stringify(matchedCategories, null, 2)}

Force WhatsApp:
${forceWhatsapp}

Matched knowledge files:
${JSON.stringify(
  knowledgeHits.map((hit) => ({
    id: hit.id,
    file: hit.file,
    score: hit.score
  })),
  null,
  2
)}

Jothrah knowledge context:
${knowledgeContext}

Important response rules:
- Use the knowledge context above when it is available.
- Keep the answer short and useful for an ecommerce chat widget.
- Do not invent pesticide dosage, dilution, mixing ratios, safety claims, or product recommendations.
- If dosage or exact method is not present in the knowledge context, tell the customer to follow the product label.
- Maximum 3 advice items.
- Maximum 2 follow-up questions.
- If children, pets, pregnancy, asthma, allergy, poisoning symptoms, bedroom, closed place, food, or strong odor are mentioned, set whatsapp_needed to true.
- Return only valid JSON matching the schema.
`
        },
        {
          role: "user",
          content: message
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: responseSchema
      }
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const data = JSON.parse(raw);

    const whatsappMessage =
      data.whatsapp_message ||
      (language === "ar"
        ? `السلام عليكم، أحتاج مساعدة في: ${message}`
        : `Hello, I need help with: ${message}`);

    return NextResponse.json(
      {
        ...data,
        language,
        categories:
          Array.isArray(data.categories) && data.categories.length
            ? data.categories
            : matchedCategories,
        whatsapp_needed: Boolean(data.whatsapp_needed || forceWhatsapp),
        whatsapp_url: buildWhatsappUrl(whatsappMessage)
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
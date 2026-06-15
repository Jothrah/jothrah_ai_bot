import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { jothrahSystemPrompt } from "@/lib/jothrah-system-prompt";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import { detectLanguage, matchCategories } from "@/lib/matcher";
import { needsWhatsapp } from "@/lib/safety";

export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const language = detectLanguage(message);
    const matchedCategories = matchCategories(message, language);
    const forceWhatsapp = needsWhatsapp(message);

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
Matched categories:
${JSON.stringify(matchedCategories, null, 2)}

Force WhatsApp:
${forceWhatsapp}
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
        categories: data.categories?.length ? data.categories : matchedCategories,
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
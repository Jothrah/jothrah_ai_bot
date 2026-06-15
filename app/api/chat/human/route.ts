import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { saveChatEvent, saveChatMessage, upsertConversation } from "@/lib/chat-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Language = "ar" | "en";

function corsHeaders(origin?: string | null) {
  const rawAllowedOrigins = process.env.ALLOWED_ORIGIN || "https://jothrah.com";
  const allowedOrigins = rawAllowedOrigins.split(",").map((item) => item.trim()).filter(Boolean);
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "https://jothrah.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req.headers.get("origin")) });
}

function normalizeLanguage(value: unknown): Language {
  return String(value || "").toLowerCase().startsWith("en") ? "en" : "ar";
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json();
    const visitorId = String(body.visitor_id || body.visitorId || "").trim();
    const language = normalizeLanguage(body.language);
    const message = String(body.message || "طلب تواصل مع مختص").trim();
    const pageUrl = String(body.page_url || body.pageUrl || "").trim();
    const customerName = String(body.customer_name || body.customerName || "").trim();
    const customerPhone = String(body.customer_phone || body.customerPhone || "").trim();
    const customerEmail = String(body.customer_email || body.customerEmail || "").trim();

    if (!visitorId) {
      return NextResponse.json(
        { error: "visitor_id is required" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const conversation = await upsertConversation({
      visitorId,
      language,
      message,
      pageUrl,
      userAgent: req.headers.get("user-agent") || "",
      needsHuman: true,
      customerName,
      customerPhone,
      customerEmail,
      metadata: {
        humanRequestedFrom: "client_button"
      }
    });

    await saveChatMessage({
      conversationId: conversation.id,
      senderType: "system",
      message: language === "ar" ? "تم طلب مختص جذرة." : "Jothrah specialist requested.",
      metadata: { event: "human_requested" }
    });

    await saveChatEvent({
      conversationId: conversation.id,
      visitorId,
      eventName: "human_support_requested",
      eventData: { source: "client_button" }
    });

    await supabaseAdmin
      .from("chat_conversations")
      .update({
        status: "needs_human",
        needs_human: true,
        human_requested_at: new Date().toISOString()
      })
      .eq("id", conversation.id);

    return NextResponse.json(
      {
        mode: "human_waiting",
        status: "needs_human",
        conversation_id: conversation.id,
        summary:
          language === "ar"
            ? "تم تحويل المحادثة إلى مختص جذرة. يرجى الانتظار حتى يتم الرد عليك داخل هذه الدردشة."
            : "The conversation has been transferred to a Jothrah specialist. Please wait for a reply inside this chat."
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error("POST /api/chat/human error:", error);
    return NextResponse.json(
      { error: "Failed to request human support" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}

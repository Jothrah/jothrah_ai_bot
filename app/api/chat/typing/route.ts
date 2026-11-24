import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders(origin?: string | null) {
  const allowedOrigins = (process.env.ALLOWED_ORIGIN || "https://jothrah.com")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigin =
    origin && (allowedOrigins.includes(origin) || /^https:\/\/([a-z0-9-]+\.)?jothrah\.com$/i.test(origin)) ? origin : allowedOrigins[0] || "https://jothrah.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req.headers.get("origin")) });
}

/** العميل يكتب الآن — يظهر للمختص في لوحة التحكم. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json().catch(() => ({}));
    const conversationId = String(body.conversation_id || "").trim();
    const visitorId = String(body.visitor_id || "").trim();

    if (!conversationId || !visitorId) {
      return NextResponse.json({ ok: false }, { status: 400, headers: corsHeaders(origin) });
    }

    const { data: conversation } = await supabaseAdmin
      .from("chat_conversations")
      .select("id, visitor_id, metadata, status")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conversation || conversation.visitor_id !== visitorId || conversation.status === "closed") {
      return NextResponse.json({ ok: false }, { headers: corsHeaders(origin) });
    }

    await supabaseAdmin
      .from("chat_conversations")
      .update({
        metadata: {
          ...(conversation.metadata || {}),
          customer_typing_at: new Date().toISOString(),
          customer_draft: String(body.draft || "").replace(/[<>]/g, "").slice(0, 160),
        },
      })
      .eq("id", conversationId);

    return NextResponse.json({ ok: true }, { headers: corsHeaders(origin) });
  } catch (error) {
    console.error("POST /api/chat/typing error:", error);
    return NextResponse.json({ ok: false }, { status: 500, headers: corsHeaders(origin) });
  }
}

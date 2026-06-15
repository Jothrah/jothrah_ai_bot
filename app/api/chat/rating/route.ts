import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { saveChatEvent } from "@/lib/chat-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json();
    const conversationId = String(body.conversation_id || body.conversationId || "").trim();
    const rating = Math.max(1, Math.min(5, Number(body.rating || 0)));
    const note = String(body.note || "").trim().slice(0, 1000);

    if (!conversationId || !rating) {
      return NextResponse.json(
        { error: "conversation_id and rating are required" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("chat_conversations")
      .update({ rating, rating_note: note || null, rated_at: now })
      .eq("id", conversationId);

    if (error) throw error;

    await saveChatEvent({
      conversationId,
      eventName: "chat_rated",
      eventData: { rating, hasNote: Boolean(note) }
    });

    return NextResponse.json({ ok: true }, { headers: corsHeaders(origin) });
  } catch (error) {
    console.error("POST /api/chat/rating error:", error);
    return NextResponse.json(
      { error: "Failed to save rating" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}

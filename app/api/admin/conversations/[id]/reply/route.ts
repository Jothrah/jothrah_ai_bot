import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const conversationId = String(id || "").trim();
    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim();

    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: "conversation id is required" },
        { status: 400 },
      );
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "message is required" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const { error: messageError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "human",
        message,
        metadata: { source: "admin_panel" },
      });

    if (messageError) {
      return NextResponse.json(
        { ok: false, error: messageError.message },
        { status: 500 },
      );
    }

    const { error: conversationError } = await supabaseAdmin
      .from("chat_conversations")
      .update({
        status: "human_replied",
        needs_human: false,
        last_message: message,
        last_message_at: now,
        unread_admin_count: 0,
      })
      .eq("id", conversationId);

    if (conversationError) {
      return NextResponse.json(
        { ok: false, error: conversationError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/conversations/[id]/reply error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

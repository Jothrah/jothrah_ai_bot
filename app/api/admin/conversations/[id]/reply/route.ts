import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { saveChatEvent, saveChatMessage } from "@/lib/chat-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, props: Params) {
  try {
    const { id } = await props.params;
    const body = await req.json();
    const message = String(body.message || "").trim();

    if (!id || !message) {
      return NextResponse.json(
        { error: "conversation id and message are required" },
        { status: 400 }
      );
    }

    const saved = await saveChatMessage({
      conversationId: id,
      senderType: "human",
      message,
      metadata: { fromAdminPanel: true, senderLabel: "مختص جذرة" }
    });

    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("chat_conversations")
      .update({
        status: "human_replied",
        needs_human: false,
        unread_admin_count: 0,
        last_message: message,
        last_message_at: now,
        last_human_reply_at: now
      })
      .eq("id", id);

    if (error) throw error;

    await saveChatEvent({
      conversationId: id,
      eventName: "human_reply_sent",
      eventData: { messageId: saved.id }
    });

    return NextResponse.json({ ok: true, message: saved });
  } catch (error) {
    console.error("POST admin reply error:", error);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 }
    );
  }
}

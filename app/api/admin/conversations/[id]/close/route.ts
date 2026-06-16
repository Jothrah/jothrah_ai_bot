import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { saveChatEvent, saveChatMessage } from "@/lib/chat-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, props: Params) {
  try {
    const { id } = await props.params;
    const body = await req.json().catch(() => ({}));
    const note = String(body.note || "").trim();
    const message = note || "تم إنهاء المحادثة من قبل مختص جذرة. نسعد بتقييم تجربتك.";
    const now = new Date().toISOString();

    await saveChatMessage({
      conversationId: id,
      senderType: "system",
      message,
      metadata: { event: "conversation_closed", ratingPrompt: true }
    });

    const { error } = await supabaseAdmin
      .from("chat_conversations")
      .update({
        status: "closed",
        needs_human: false,
        closed_at: now,
        closed_by: "admin",
        last_message: message,
        last_message_at: now
      })
      .eq("id", id);

    if (error) throw error;

    await saveChatEvent({
      conversationId: id,
      eventName: "conversation_closed",
      eventData: { closedBy: "admin" }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST admin close error:", error);
    return NextResponse.json(
      { error: "Failed to close conversation" },
      { status: 500 }
    );
  }
}

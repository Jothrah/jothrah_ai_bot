import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const conversationId = String(id || "").trim();

    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: "conversation id is required" },
        { status: 400 },
      );
    }

    const { error: messagesError } = await supabaseAdmin
      .from("chat_messages")
      .delete()
      .eq("conversation_id", conversationId);

    if (messagesError) {
      return NextResponse.json(
        { ok: false, error: messagesError.message },
        { status: 500 },
      );
    }

    await supabaseAdmin
      .from("chat_events")
      .delete()
      .eq("conversation_id", conversationId)
      .then(() => null);

    const { error: conversationError } = await supabaseAdmin
      .from("chat_conversations")
      .delete()
      .eq("id", conversationId);

    if (conversationError) {
      return NextResponse.json(
        { ok: false, error: conversationError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/conversations/[id]/delete error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const selectedId = String(searchParams.get("id") || "").trim();

    const { data: conversations, error: conversationsError } = await supabaseAdmin
      .from("chat_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(100);

    if (conversationsError) {
      return NextResponse.json(
        { ok: false, error: conversationsError.message },
        { status: 500 },
      );
    }

    let selectedConversation: any = null;

    if (selectedId) {
      selectedConversation =
        conversations?.find((item) => item.id === selectedId) || null;

      // لو المحادثة خارج أول 100 نتيجة، نجيبها مباشرة بدل ما نرجع null.
      if (!selectedConversation) {
        const { data: directConversation, error: directConversationError } =
          await supabaseAdmin
            .from("chat_conversations")
            .select("*")
            .eq("id", selectedId)
            .maybeSingle();

        if (directConversationError) {
          return NextResponse.json(
            { ok: false, error: directConversationError.message },
            { status: 500 },
          );
        }

        selectedConversation = directConversation || null;
      }
    }

    let messages: any[] = [];

    if (selectedConversation?.id) {
      const { data, error: messagesError } = await supabaseAdmin
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", selectedConversation.id)
        .order("created_at", { ascending: true })
        .limit(300);

      if (messagesError) {
        return NextResponse.json(
          { ok: false, error: messagesError.message },
          { status: 500 },
        );
      }

      messages = data || [];

      // عند فتح المحادثة من الأدمن نصفر عداد غير المقروء للأدمن.
      await supabaseAdmin
        .from("chat_conversations")
        .update({ unread_admin_count: 0 })
        .eq("id", selectedConversation.id)
        .then(() => null);
    }

    return NextResponse.json({
      ok: true,
      conversations: conversations || [],
      selectedConversation,
      messages,
      selectedId: selectedConversation?.id || null,
    });
  } catch (error) {
    console.error("GET /api/admin/conversations error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

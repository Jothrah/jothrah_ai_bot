import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getPayload(selectedId?: string | null) {
  const cleanSelectedId = String(selectedId || "").trim();

  const { data: conversationsData, error: conversationsError } =
    await supabaseAdmin
      .from("chat_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(100);

  if (conversationsError) throw conversationsError;

  let conversations = conversationsData || [];
  let selectedConversation: any = null;

  /**
   * مهم:
   * لا نفتح أول محادثة تلقائيًا.
   * إذا لا يوجد id، نرجع القائمة فقط.
   * إذا يوجد id ولم يكن ضمن أول 100 محادثة، نجيبه مباشرة من قاعدة البيانات.
   */
  if (cleanSelectedId) {
    selectedConversation =
      conversations.find((item) => item.id === cleanSelectedId) || null;

    if (!selectedConversation) {
      const { data: directConversation, error: directConversationError } =
        await supabaseAdmin
          .from("chat_conversations")
          .select("*")
          .eq("id", cleanSelectedId)
          .maybeSingle();

      if (directConversationError) throw directConversationError;

      selectedConversation = directConversation || null;

      if (selectedConversation) {
        conversations = [
          selectedConversation,
          ...conversations.filter((item) => item.id !== selectedConversation.id),
        ];
      }
    }
  }

  let messages: any[] = [];

  if (selectedConversation?.id) {
    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", selectedConversation.id)
      .order("created_at", { ascending: true })
      .limit(300);

    if (error) throw error;
    messages = data || [];

    const { error: unreadError } = await supabaseAdmin
      .from("chat_conversations")
      .update({ unread_admin_count: 0 })
      .eq("id", selectedConversation.id);

    if (unreadError) {
      console.warn("Failed to reset unread_admin_count:", unreadError.message);
    }

    conversations = conversations.map((item) =>
      item.id === selectedConversation.id
        ? { ...item, unread_admin_count: 0 }
        : item,
    );
  }

  const waitingCount = conversations.filter(
    (item) => item.status === "needs_human" || item.needs_human,
  ).length;

  const unreadCount = conversations.reduce(
    (sum, item) => sum + (Number(item.unread_admin_count || 0) || 0),
    0,
  );

  return {
    conversations,
    selectedConversation,
    messages,
    stats: {
      waitingCount,
      unreadCount,
      total: conversations.length,
    },
    serverTime: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const selectedId = url.searchParams.get("id");
    return NextResponse.json(await getPayload(selectedId));
  } catch (error) {
    console.error("GET /api/admin/conversations error:", error);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getPayload(selectedId?: string | null) {
  const { data: conversations, error: conversationsError } = await supabaseAdmin
    .from("chat_conversations")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (conversationsError) throw conversationsError;

  const selectedConversation =
    (selectedId && conversations?.find((item) => item.id === selectedId)) ||
    conversations?.[0] ||
    null;

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

    await supabaseAdmin
      .from("chat_conversations")
      .update({ unread_admin_count: 0 })
      .eq("id", selectedConversation.id);
  }

  const waitingCount = (conversations || []).filter(
    (item) => item.status === "needs_human" || item.needs_human
  ).length;

  const unreadCount = (conversations || []).reduce(
    (sum, item) => sum + (Number(item.unread_admin_count || 0) || 0),
    0
  );

  return {
    conversations: conversations || [],
    selectedConversation,
    messages,
    stats: {
      waitingCount,
      unreadCount,
      total: conversations?.length || 0
    },
    serverTime: new Date().toISOString()
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
      { status: 500 }
    );
  }
}

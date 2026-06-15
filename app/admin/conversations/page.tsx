import { supabaseAdmin } from "@/lib/supabase-admin";
import AdminConversationsClient from "./AdminConversationsClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ id?: string }>;
};

async function getInitialData(selectedId?: string) {
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
  }

  return {
    conversations: conversations || [],
    selectedConversation,
    messages,
    selectedId: selectedConversation?.id || selectedId || null
  };
}

export default async function ConversationsPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const initialData = await getInitialData(searchParams?.id);

  return <AdminConversationsClient initialData={initialData} />;
}

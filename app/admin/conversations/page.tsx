import { supabaseAdmin } from "@/lib/supabase-admin";
import AdminConversationsClient from "./AdminConversationsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Next 15 يمرر searchParams كـ Promise في بعض الإعدادات
// نخلي النوع متوافقًا مع الموجود عندك.
type PageProps = {
  searchParams?: Promise<{ id?: string }>;
};

async function getInitialData(selectedId?: string) {
  const cleanSelectedId = String(selectedId || "").trim();

  const { data: conversations, error: conversationsError } = await supabaseAdmin
    .from("chat_conversations")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (conversationsError) throw conversationsError;

  let selectedConversation: any = null;

  // مهم: لا نفتح أول محادثة تلقائيًا إذا ما فيه id.
  // واجهة الجوال لازم تبدأ بقائمة المحادثات فقط.
  if (cleanSelectedId) {
    selectedConversation =
      conversations?.find((item) => item.id === cleanSelectedId) || null;

    // حماية: لو المحادثة ليست ضمن أول 100 نتيجة، نسحبها مباشرة بالـ id.
    if (!selectedConversation) {
      const { data: directConversation, error: directConversationError } =
        await supabaseAdmin
          .from("chat_conversations")
          .select("*")
          .eq("id", cleanSelectedId)
          .maybeSingle();

      if (directConversationError) throw directConversationError;
      selectedConversation = directConversation || null;
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
  }

  return {
    conversations: conversations || [],
    selectedConversation,
    messages,
    selectedId: selectedConversation?.id || null,
  };
}

export default async function ConversationsPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const initialData = await getInitialData(searchParams?.id);

  return <AdminConversationsClient initialData={initialData} />;
}

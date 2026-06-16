import { supabaseAdmin } from "@/lib/supabase-admin";
import AdminConversationsClient from "./AdminConversationsClient";

export const dynamic = "force-dynamic";

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

  /**
   * مهم:
   * لا نفتح أول محادثة تلقائيًا.
   * إذا ما فيه id في الرابط، نخلي selectedConversation = null
   * عشان الجوال يعرض قائمة المحادثات فقط.
   */
  if (cleanSelectedId) {
    selectedConversation =
      conversations?.find((item) => item.id === cleanSelectedId) || null;

    /**
     * حماية إضافية:
     * لو المحادثة المطلوبة ليست ضمن أول 100 محادثة،
     * نجيبها مباشرة من قاعدة البيانات بدل ما نرجع لأول محادثة بالغلط.
     */
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
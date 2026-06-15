import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import ReplyForm from "./ReplyForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    id?: string;
  }>;
};

async function getConversations() {
  const { data, error } = await supabaseAdmin
    .from("chat_conversations")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data || [];
}

async function getMessages(conversationId?: string) {
  if (!conversationId) return [];

  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

function formatDate(value?: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}

async function sendHumanReply(formData: FormData) {
  "use server";

  const conversationId = String(formData.get("conversation_id") || "");
  const message = String(formData.get("message") || "").trim();

  if (!conversationId || !message) {
    redirect(`/admin/conversations?id=${conversationId}`);
  }

  const { error: messageError } = await supabaseAdmin
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_type: "human",
      message,
      metadata: {
        fromAdminPanel: true,
      },
    });

  if (messageError) {
    throw messageError;
  }

  const { error: conversationError } = await supabaseAdmin
    .from("chat_conversations")
    .update({
      status: "human_replied",
      needs_human: false,
      last_message: message,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (conversationError) {
    throw conversationError;
  }

  redirect(`/admin/conversations?id=${conversationId}`);
}

export default async function ConversationsPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const selectedId = searchParams?.id;

  const conversations = await getConversations();
  const selectedConversation =
    conversations.find((item) => item.id === selectedId) || conversations[0];

  const messages = await getMessages(selectedConversation?.id);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>محادثات جذرة</h1>
          <p style={styles.subtitle}>
            لوحة أولية لمتابعة رسائل العملاء وردود الذكاء الصناعي.
          </p>
        </div>

        <div style={styles.badge}>Jothrah AI Support</div>
      </header>

      <section style={styles.layout}>
        <aside style={styles.sidebar}>
          <h2 style={styles.sideTitle}>المحادثات</h2>

          {conversations.length === 0 ? (
            <div style={styles.empty}>لا توجد محادثات حتى الآن.</div>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.id === selectedConversation?.id;

              return (
                <a
                  key={conversation.id}
                  href={`/admin/conversations?id=${conversation.id}`}
                  style={{
                    ...styles.conversationCard,
                    ...(active ? styles.conversationCardActive : {}),
                  }}
                >
                  <div style={styles.conversationTop}>
                    <strong>
                      {conversation.customer_name ||
                        conversation.visitor_id ||
                        "زائر"}
                    </strong>

                    <span style={styles.status}>{conversation.status}</span>
                  </div>

                  <p style={styles.lastMessage}>
                    {conversation.last_message || "بدون رسالة"}
                  </p>

                  <small style={styles.time}>
                    {formatDate(conversation.last_message_at)}
                  </small>
                </a>
              );
            })
          )}
        </aside>

        <section style={styles.chatPanel}>
          {selectedConversation ? (
            <>
              <div style={styles.chatHeader}>
                <div>
                  <h2 style={styles.chatTitle}>
                    {selectedConversation.customer_name ||
                      selectedConversation.visitor_id ||
                      "زائر"}
                  </h2>

                  <p style={styles.chatMeta}>
                    اللغة: {selectedConversation.language || "ar"} · الحالة:{" "}
                    {selectedConversation.status || "ai"}
                  </p>
                </div>

                <span style={styles.statusLarge}>
                  {selectedConversation.needs_human
                    ? "ينتظر موظف"
                    : selectedConversation.status === "human_replied"
                      ? "تم الرد بشريًا"
                      : "AI"}
                </span>
              </div>

              <div style={styles.messages}>
                {messages.map((message) => {
                  const isCustomer = message.sender_type === "customer";
                  const isAi = message.sender_type === "ai";
                  const isHuman = message.sender_type === "human";

                  return (
                    <div
                      key={message.id}
                      style={{
                        ...styles.messageRow,
                        justifyContent: isCustomer ? "flex-start" : "flex-end",
                      }}
                    >
                      <div
                        style={{
                          ...styles.messageBubble,
                          ...(isCustomer
                            ? styles.customerBubble
                            : isAi
                              ? styles.aiBubble
                              : isHuman
                                ? styles.humanBubble
                                : styles.systemBubble),
                        }}
                      >
                        <div style={styles.sender}>
                          {isCustomer
                            ? "العميل"
                            : isAi
                              ? "مساعد جذرة"
                              : isHuman
                                ? "كاظم عبدالله"
                                : message.sender_type}
                        </div>

                        {message.message ? (
                          <p style={styles.messageText}>{message.message}</p>
                        ) : null}

                        {message.image_url ? (
                          <a
                            href={message.image_url}
                            target="_blank"
                            style={styles.imageLink}
                          >
                            فتح الصورة
                          </a>
                        ) : null}

                        <small style={styles.messageTime}>
                          {formatDate(message.created_at)}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>

              <ReplyForm
                conversationId={selectedConversation.id}
                action={sendHumanReply}
                styles={{
                  replyForm: styles.replyForm,
                  replyTextarea: styles.replyTextarea,
                  replyButton: styles.replyButton,
                }}
              />
            </>
          ) : (
            <div style={styles.emptyChat}>اختر محادثة من القائمة.</div>
          )}
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#071426",
    color: "#fff",
    padding: 24,
    direction: "rtl",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 28,
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#b8c4d6",
  },
  badge: {
    background: "#12345a",
    border: "1px solid rgba(255,255,255,.12)",
    padding: "10px 14px",
    borderRadius: 999,
    fontSize: 13,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 18,
  },
  sidebar: {
    background: "#0c1d33",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 18,
    padding: 14,
    height: "calc(100vh - 120px)",
    overflow: "auto",
  },
  sideTitle: {
    fontSize: 18,
    margin: "4px 4px 14px",
  },
  conversationCard: {
    display: "block",
    textDecoration: "none",
    color: "#fff",
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  conversationCardActive: {
    background: "rgba(47, 139, 90, .25)",
    borderColor: "rgba(88, 214, 141, .45)",
  },
  conversationTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
  },
  status: {
    fontSize: 12,
    color: "#9ee6b8",
  },
  lastMessage: {
    color: "#d8e0ec",
    fontSize: 13,
    margin: "8px 0",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  time: {
    color: "#8290a3",
  },
  chatPanel: {
    background: "#0c1d33",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 18,
    height: "calc(100vh - 120px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  chatHeader: {
    padding: 18,
    borderBottom: "1px solid rgba(255,255,255,.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatTitle: {
    margin: 0,
    fontSize: 20,
  },
  chatMeta: {
    margin: "6px 0 0",
    color: "#a9b7c9",
    fontSize: 13,
  },
  statusLarge: {
    background: "#163f29",
    color: "#baffd1",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
  },
  messages: {
    flex: 1,
    padding: 18,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  messageRow: {
    display: "flex",
  },
  messageBubble: {
    maxWidth: "70%",
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,.08)",
  },
  customerBubble: {
    background: "#132942",
  },
  aiBubble: {
    background: "#12351f",
  },
  humanBubble: {
    background: "#2f5f8f",
  },
  systemBubble: {
    background: "#2b2b2b",
  },
  sender: {
    fontSize: 12,
    color: "#a9b7c9",
    marginBottom: 6,
  },
  messageText: {
    margin: 0,
    lineHeight: 1.8,
    whiteSpace: "pre-wrap",
  },
  messageTime: {
    display: "block",
    color: "#7f8ea3",
    marginTop: 8,
  },
  imageLink: {
    color: "#9ee6b8",
    display: "inline-block",
    marginTop: 8,
  },
  replyForm: {
    display: "flex",
    gap: 10,
    padding: 14,
    borderTop: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.03)",
  },
  replyTextarea: {
    flex: 1,
    minHeight: 52,
    resize: "vertical",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.14)",
    background: "#071426",
    color: "#fff",
    padding: 12,
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
  },
  replyButton: {
    border: 0,
    borderRadius: 12,
    background: "#2f8b5a",
    color: "#fff",
    padding: "0 18px",
    fontWeight: 700,
    cursor: "pointer",
  },
  empty: {
    color: "#a9b7c9",
    padding: 12,
  },
  emptyChat: {
    margin: "auto",
    color: "#a9b7c9",
  },
};

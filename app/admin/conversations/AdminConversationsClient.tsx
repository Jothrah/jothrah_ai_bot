"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Conversation = Record<string, any>;
type ChatMessage = Record<string, any>;

type InitialData = {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: ChatMessage[];
  selectedId: string | null;
};

type Props = {
  initialData: InitialData;
};

const QUICK_EMOJIS = ["✅", "🌿", "📷", "🙏", "👍", "😊", "✨", "💬"];

const QUICK_REPLIES = [
  "حياك الله، ارسل لي صورة واضحة للمشكلة إن أمكن.",
  "تم استلام رسالتك، أراجع التفاصيل وأرد عليك الآن.",
  "وش نوع النبات؟ وكم عمر المشكلة تقريبًا؟",
  "هل المشكلة داخل البيت أو في الحوش/المزرعة؟",
  "اتبع تعليمات ملصق المنتج دائمًا ولا تستخدم أي مبيد قرب الأطفال أو الحيوانات أو الطعام."
];

function formatDateTime(value?: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Riyadh"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatTime(value?: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ar-SA", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Riyadh"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDay(value?: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "full",
      timeZone: "Asia/Riyadh"
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function getCustomerName(conversation?: Conversation | null) {
  return (
    conversation?.customer_name ||
    conversation?.customer_phone ||
    conversation?.customer_email ||
    conversation?.visitor_id ||
    "زائر"
  );
}

function statusLabel(conversation?: Conversation | null) {
  const status = conversation?.status;

  if (status === "needs_human" || conversation?.needs_human) return "بانتظار مختص";
  if (status === "human_replied") return "تم الرد";
  if (status === "closed") return "مغلقة";
  return "ذكاء صناعي";
}

function statusTone(conversation?: Conversation | null) {
  const status = conversation?.status;

  if (status === "needs_human" || conversation?.needs_human) return "danger";
  if (status === "human_replied") return "success";
  if (status === "closed") return "muted";
  return "ai";
}

function senderLabel(message: ChatMessage) {
  if (message.sender_type === "customer") return "العميل";
  if (message.sender_type === "human") return "مختص جذرة";
  if (message.sender_type === "ai") return "مساعد جذرة";
  return "النظام";
}

function senderIcon(message: ChatMessage) {
  if (message.sender_type === "customer") return "👤";
  if (message.sender_type === "human") return "🌿";
  if (message.sender_type === "ai") return "ج";
  return "•";
}

function messageClass(message: ChatMessage) {
  if (message.sender_type === "customer") return "customer";
  if (message.sender_type === "human") return "human";
  if (message.sender_type === "ai") return "ai";
  return "system";
}

function conversationMatches(conversation: Conversation, query: string) {
  const text = [
    conversation.customer_name,
    conversation.customer_phone,
    conversation.customer_email,
    conversation.visitor_id,
    conversation.last_message,
    conversation.status,
    conversation.language
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes(query.trim().toLowerCase());
}

function playLuxuryNotify() {
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const gain = ctx.createGain();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const o3 = ctx.createOscillator();

    o1.type = "sine";
    o2.type = "triangle";
    o3.type = "sine";

    o1.frequency.setValueAtTime(587, ctx.currentTime);
    o2.frequency.setValueAtTime(784, ctx.currentTime + 0.055);
    o3.frequency.setValueAtTime(1046, ctx.currentTime + 0.11);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.105, ctx.currentTime + 0.024);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.34);

    o1.connect(gain);
    o2.connect(gain);
    o3.connect(gain);
    gain.connect(ctx.destination);

    o1.start(ctx.currentTime);
    o1.stop(ctx.currentTime + 0.13);
    o2.start(ctx.currentTime + 0.07);
    o2.stop(ctx.currentTime + 0.22);
    o3.start(ctx.currentTime + 0.14);
    o3.stop(ctx.currentTime + 0.34);

    setTimeout(() => ctx.close?.(), 520);
  } catch {}
}

export default function AdminConversationsClient({ initialData }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>(initialData.conversations || []);
  const [selectedId, setSelectedId] = useState<string | null>(initialData.selectedId || null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(initialData.selectedConversation || null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialData.messages || []);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "waiting" | "open" | "closed">("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);

  const lastSeenCustomerMessageId = useRef<string | null>(null);
  const lastTotalUnreadRef = useRef<number>(
    (initialData.conversations || []).reduce((sum, item) => sum + (Number(item.unread_admin_count || 0) || 0), 0)
  );
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const stats = useMemo(() => {
    const waiting = conversations.filter((item) => item.status === "needs_human" || item.needs_human).length;
    const unread = conversations.reduce((sum, item) => sum + (Number(item.unread_admin_count || 0) || 0), 0);
    const closed = conversations.filter((item) => item.status === "closed").length;
    const open = conversations.filter((item) => item.status !== "closed").length;

    return { waiting, unread, closed, open, total: conversations.length };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    let items = conversations;

    if (filter === "waiting") {
      items = items.filter((item) => item.status === "needs_human" || item.needs_human);
    }

    if (filter === "open") {
      items = items.filter((item) => item.status !== "closed");
    }

    if (filter === "closed") {
      items = items.filter((item) => item.status === "closed");
    }

    if (query.trim()) {
      items = items.filter((conversation) => conversationMatches(conversation, query));
    }

    return items;
  }, [conversations, filter, query]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ block: "end" }), 40);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ block: "end" }), 160);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ block: "end" }), 360);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedId, scrollToBottom]);

  useEffect(() => {
    document.title = stats.waiting > 0 ? `(${stats.waiting}) محادثات جذرة` : "محادثات جذرة";
  }, [stats.waiting]);

  const flashToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3200);
  }, []);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const id = selectedIdRef.current;
    const url = id ? `/api/admin/conversations?id=${encodeURIComponent(id)}` : "/api/admin/conversations";

    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "تعذر تحديث المحادثات");

      const nextConversations = data.conversations || [];
      const nextMessages = data.messages || [];
      const nextSelected = data.selectedConversation || null;
      const nextTotalUnread = nextConversations.reduce(
        (sum: number, item: Conversation) => sum + (Number(item.unread_admin_count || 0) || 0),
        0
      );
      const newestCustomer = [...nextMessages].reverse().find((msg) => msg.sender_type === "customer");
      const selectedHasNewCustomer =
        Boolean(newestCustomer?.id) &&
        Boolean(lastSeenCustomerMessageId.current) &&
        newestCustomer.id !== lastSeenCustomerMessageId.current;
      const hasNewUnread = nextTotalUnread > lastTotalUnreadRef.current;

      if (soundEnabled && (selectedHasNewCustomer || hasNewUnread)) {
        playLuxuryNotify();
        flashToast("وصلت رسالة جديدة من عميل ✨");
      }

      if (newestCustomer?.id) {
        lastSeenCustomerMessageId.current = newestCustomer.id;
      }
      lastTotalUnreadRef.current = nextTotalUnread;

      setConversations(nextConversations);
      setSelectedConversation(nextSelected);
      setMessages(nextMessages);
      scrollToBottom();
    } catch (error) {
      if (!options?.silent) {
        flashToast(error instanceof Error ? error.message : "حدث خطأ أثناء التحديث");
      }
    }
  }, [flashToast, scrollToBottom, soundEnabled]);

  useEffect(() => {
    const newestCustomer = [...messages].reverse().find((msg) => msg.sender_type === "customer");
    if (newestCustomer?.id) lastSeenCustomerMessageId.current = newestCustomer.id;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => refresh({ silent: true }), 2200);
    return () => clearInterval(timer);
  }, [refresh]);

  async function selectConversation(id: string) {
    setSelectedId(id);
    window.history.replaceState(null, "", `/admin/conversations?id=${id}`);

    try {
      const res = await fetch(`/api/admin/conversations?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "تعذر فتح المحادثة");
      setConversations(data.conversations || []);
      setSelectedConversation(data.selectedConversation || null);
      setMessages(data.messages || []);
      const newestCustomer = [...(data.messages || [])].reverse().find((msg: ChatMessage) => msg.sender_type === "customer");
      if (newestCustomer?.id) lastSeenCustomerMessageId.current = newestCustomer.id;
      lastTotalUnreadRef.current = (data.conversations || []).reduce(
        (sum: number, item: Conversation) => sum + (Number(item.unread_admin_count || 0) || 0),
        0
      );
      scrollToBottom();
    } catch (error) {
      flashToast(error instanceof Error ? error.message : "تعذر فتح المحادثة");
    }
  }

  async function sendReply() {
    const message = reply.trim();
    if (!selectedId || !message || loading) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/admin/conversations/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || "تعذر إرسال الرد");

      setReply("");
      setEmojiOpen(false);
      await refresh({ silent: true });
    } catch (error) {
      flashToast(error instanceof Error ? error.message : "تعذر إرسال الرد");
    } finally {
      setLoading(false);
    }
  }

  async function closeConversation() {
    if (!selectedId || loading) return;
    if (!confirm("إنهاء المحادثة؟ سيظهر للعميل طلب تقييم الخدمة.")) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/admin/conversations/${selectedId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "تعذر إنهاء المحادثة");
      flashToast("تم إنهاء المحادثة وإرسال التقييم للعميل ✅");
      await refresh({ silent: true });
    } catch (error) {
      flashToast(error instanceof Error ? error.message : "تعذر إنهاء المحادثة");
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation() {
    if (!selectedId || loading) return;
    const name = getCustomerName(selectedConversation);
    if (!confirm(`حذف ${name} نهائيًا من قاعدة البيانات؟ لا يمكن التراجع.`)) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/admin/conversations/${selectedId}/delete`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "تعذر حذف المحادثة");
      flashToast("تم حذف المحادثة نهائيًا 🗑️");
      setSelectedId(null);
      window.history.replaceState(null, "", "/admin/conversations");
      await refresh({ silent: true });
    } catch (error) {
      flashToast(error instanceof Error ? error.message : "تعذر حذف المحادثة");
    } finally {
      setLoading(false);
    }
  }

  function appendToReply(value: string) {
    setReply((current) => `${current}${value}`);
  }

  function copyConversationInfo() {
    if (!selectedConversation) return;

    const text = [
      `العميل: ${getCustomerName(selectedConversation)}`,
      `الحالة: ${statusLabel(selectedConversation)}`,
      `الهاتف: ${selectedConversation.customer_phone || "غير متوفر"}`,
      `الإيميل: ${selectedConversation.customer_email || "غير متوفر"}`,
      `الرابط: ${selectedConversation.page_url || "غير متوفر"}`,
      `آخر رسالة: ${formatDateTime(selectedConversation.last_message_at)}`
    ].join("\n");

    navigator.clipboard?.writeText(text).then(
      () => flashToast("تم نسخ بيانات المحادثة ✨"),
      () => flashToast("تعذر النسخ من المتصفح")
    );
  }

  let lastDay = "";

  return (
    <main className="jth-admin-shell" dir="rtl">
      <style jsx global>{styles}</style>

      {toast ? <div className="jth-toast">{toast}</div> : null}

      <header className="jth-topbar">
        <div className="jth-brand-card">
          <div className="jth-brand-mark">ج</div>
          <div>
            <div className="jth-kicker">Jothrah Client Care Suite</div>
            <h1>محادثات جذرة</h1>
            <p>لوحة ناعمة لإدارة محادثات العملاء، الردود، الإنهاء، التقييم والتنبيهات.</p>
          </div>
        </div>

        <div className="jth-actions-top">
          <button
            type="button"
            className={soundEnabled ? "jth-sound is-on" : "jth-sound"}
            onClick={() => {
              setSoundEnabled(true);
              playLuxuryNotify();
              flashToast("تم تفعيل صوت تنبيهات المحادثات ✅");
            }}
          >
            <span>🔔</span>
            {soundEnabled ? "الصوت مفعل" : "تفعيل الصوت"}
          </button>
          <button type="button" className="jth-refresh" onClick={() => refresh()}>
            تحديث الآن
          </button>
        </div>
      </header>

      <section className="jth-stats-grid">
        <div className="stat-card pearl"><strong>{stats.total}</strong><span>كل المحادثات</span></div>
        <div className="stat-card hot"><strong>{stats.waiting}</strong><span>بانتظار الرد</span></div>
        <div className="stat-card jade"><strong>{stats.unread}</strong><span>رسائل جديدة</span></div>
        <div className="stat-card mist"><strong>{stats.closed}</strong><span>مغلقة</span></div>
      </section>

      <section className={detailsOpen ? "jth-layout" : "jth-layout details-collapsed"}>
        <aside className="jth-sidebar">
          <div className="jth-sidebar-head">
            <div>
              <strong>صندوق المحادثات</strong>
              <span>{stats.open} محادثة نشطة</span>
            </div>
            {stats.waiting > 0 ? <b className="jth-wait-badge">{stats.waiting}</b> : null}
          </div>

          <div className="jth-search-box">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بالاسم، الرقم، آخر رسالة…"
            />
          </div>

          <div className="jth-tabs">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>الكل</button>
            <button className={filter === "waiting" ? "active" : ""} onClick={() => setFilter("waiting")}>تحتاج رد</button>
            <button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>نشطة</button>
            <button className={filter === "closed" ? "active" : ""} onClick={() => setFilter("closed")}>مغلقة</button>
          </div>

          <div className="jth-conv-list">
            {filteredConversations.length === 0 ? (
              <div className="jth-empty compact">لا توجد محادثات في هذا التصنيف.</div>
            ) : (
              filteredConversations.map((conversation) => {
                const active = conversation.id === selectedId;
                const tone = statusTone(conversation);
                const unread = Number(conversation.unread_admin_count || 0) || 0;

                return (
                  <button
                    type="button"
                    key={conversation.id}
                    className={active ? "jth-conv active" : "jth-conv"}
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <span className={`jth-conv-glow ${tone}`} />
                    <div className="jth-conv-head">
                      <div className="jth-avatar">{String(getCustomerName(conversation)).slice(0, 1)}</div>
                      <div className="jth-conv-main">
                        <strong>{getCustomerName(conversation)}</strong>
                        <small>{formatTime(conversation.last_message_at) || "—"}</small>
                      </div>
                      <span className={`pill ${tone}`}>{statusLabel(conversation)}</span>
                    </div>
                    <p>{conversation.last_message || "بدون رسالة"}</p>
                    <div className="jth-conv-foot">
                      <small>{formatDateTime(conversation.last_message_at)}</small>
                      {unread > 0 ? <b>{unread > 9 ? "9+" : unread}</b> : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="jth-chat-card">
          {selectedConversation ? (
            <>
              <div className="jth-chat-head">
                <div className="jth-chat-title-area">
                  <div className="jth-customer-line">
                    <div className="jth-avatar large">{String(getCustomerName(selectedConversation)).slice(0, 1)}</div>
                    <div>
                      <h2>{getCustomerName(selectedConversation)}</h2>
                      <p>
                        اللغة: {selectedConversation.language || "ar"} · آخر نشاط: {formatDateTime(selectedConversation.last_message_at)}
                      </p>
                    </div>
                    <span className={`pill big ${statusTone(selectedConversation)}`}>{statusLabel(selectedConversation)}</span>
                  </div>
                </div>

                <div className="jth-chat-buttons">
                  <button type="button" className="soft" onClick={() => setDetailsOpen((value) => !value)}>
                    {detailsOpen ? "إخفاء التفاصيل" : "إظهار التفاصيل"}
                  </button>
                  <button type="button" className="close" onClick={closeConversation} disabled={loading || selectedConversation.status === "closed"}>
                    إنهاء المحادثة
                  </button>
                  <button type="button" className="delete" onClick={deleteConversation} disabled={loading}>
                    حذف نهائي
                  </button>
                </div>
              </div>

              <div className="jth-messages">
                {messages.length === 0 ? (
                  <div className="jth-empty center">لا توجد رسائل داخل هذه المحادثة.</div>
                ) : (
                  messages.map((message) => {
                    const day = formatDay(message.created_at);
                    const showDay = day && day !== lastDay;
                    if (showDay) lastDay = day;

                    return (
                      <div key={message.id}>
                        {showDay ? <div className="jth-day-separator">{day}</div> : null}
                        <div className={`jth-message-row ${messageClass(message)}`}>
                          <div className="jth-bubble">
                            <div className="jth-sender">
                              <span>{senderIcon(message)}</span>
                              {senderLabel(message)}
                            </div>
                            {message.message ? <p>{message.message}</p> : null}
                            {message.image_url ? (
                              <a href={message.image_url} target="_blank" rel="noopener noreferrer" className="jth-image-link">
                                فتح الصورة المرفقة 📷
                              </a>
                            ) : null}
                            {message.ai_detected_problem ? <small>التشخيص: {message.ai_detected_problem}</small> : null}
                            <time>{formatDateTime(message.created_at)}</time>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="jth-reply-panel">
                <div className="jth-quick-replies">
                  {QUICK_REPLIES.map((item) => (
                    <button type="button" key={item} onClick={() => setReply(item)}>
                      {item}
                    </button>
                  ))}
                </div>

                <div className="jth-reply-row">
                  <button type="button" className="emoji" onClick={() => setEmojiOpen((value) => !value)}>🙂</button>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder="اكتب ردك هنا… Enter للإرسال و Shift+Enter لسطر جديد"
                    disabled={loading || selectedConversation.status === "closed"}
                  />
                  <button type="button" className="send" onClick={sendReply} disabled={loading || !reply.trim() || selectedConversation.status === "closed"}>
                    إرسال
                  </button>
                </div>

                {emojiOpen ? (
                  <div className="jth-emoji-bar">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button type="button" key={emoji} onClick={() => appendToReply(emoji)}>{emoji}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="jth-empty center">اختر محادثة من القائمة.</div>
          )}
        </section>

        <aside className="jth-details-panel">
          {selectedConversation ? (
            <>
              <div className="jth-detail-card signature">
                <span className="mini-label">ملف العميل</span>
                <h3>{getCustomerName(selectedConversation)}</h3>
                <p>{statusLabel(selectedConversation)} · {selectedConversation.language || "ar"}</p>
              </div>

              <div className="jth-detail-card">
                <h4>بيانات التواصل</h4>
                <dl>
                  <div><dt>الجوال</dt><dd>{selectedConversation.customer_phone || "غير متوفر"}</dd></div>
                  <div><dt>الإيميل</dt><dd>{selectedConversation.customer_email || "غير متوفر"}</dd></div>
                  <div><dt>آخر نشاط</dt><dd>{formatDateTime(selectedConversation.last_message_at) || "—"}</dd></div>
                  <div><dt>بداية المحادثة</dt><dd>{formatDateTime(selectedConversation.created_at) || "—"}</dd></div>
                </dl>
                <button type="button" className="copy-btn" onClick={copyConversationInfo}>نسخ بيانات المحادثة</button>
              </div>

              <div className="jth-detail-card team-card">
                <h4>إسناد الفريق لاحقًا</h4>
                <p>جاهزة مستقبلًا لإسناد المحادثات لأكثر من مختص، متابعة أداء الفريق، وحالة كل تذكرة.</p>
                <div className="team-strip">
                  <span>المسند إليه</span>
                  <strong>{selectedConversation.assigned_to || "غير مسند"}</strong>
                </div>
              </div>

              <div className="jth-detail-card">
                <h4>رابط الصفحة</h4>
                <p className="breakable">{selectedConversation.page_url || "غير متوفر"}</p>
              </div>
            </>
          ) : (
            <div className="jth-detail-card signature"><h3>لا توجد محادثة محددة</h3></div>
          )}
        </aside>
      </section>
    </main>
  );
}


const styles = `
  :root {
    color-scheme: light;
    --jth-bg: #faf7f0;
    --jth-card: rgba(255,255,255,.88);
    --jth-solid: #fff;
    --jth-ink: #12313a;
    --jth-muted: #6d7b80;
    --jth-line: rgba(18,49,58,.10);
    --jth-emerald: #00666a;
    --jth-emerald-2: #00806d;
    --jth-jade: #18b978;
    --jth-gold: #c7a04a;
    --jth-danger: #d43b3b;
    --jth-radius: 14px;
    --jth-shadow: 0 10px 28px rgba(20, 45, 52, .08);
  }

  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden !important;
    background: var(--jth-bg) !important;
  }

  button, input, textarea { font-family: inherit; }
  button { -webkit-tap-highlight-color: transparent; }

  .jth-admin-shell {
    height: 100dvh;
    overflow: hidden;
    padding: 6px;
    box-sizing: border-box;
    color: var(--jth-ink);
    background:
      radial-gradient(circle at 9% 0%, rgba(239, 209, 121, .25), transparent 22%),
      radial-gradient(circle at 84% 0%, rgba(24, 185, 120, .12), transparent 28%),
      linear-gradient(135deg, #fbf8f0 0%, #f7fbf9 52%, #fffaf1 100%);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .jth-admin-shell::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(0, 102, 106, .018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 102, 106, .018) 1px, transparent 1px);
    background-size: 32px 32px;
  }

  .jth-toast {
    position: fixed;
    z-index: 9999;
    left: 10px;
    bottom: 10px;
    background: rgba(0,102,106,.96);
    color: #fff;
    border-radius: 14px;
    padding: 10px 12px;
    box-shadow: 0 14px 34px rgba(0,102,106,.18);
    font-weight: 900;
    font-size: 12px;
  }

  .jth-topbar {
    position: relative;
    z-index: 2;
    min-height: 42px;
    flex: 0 0 42px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .jth-brand-card {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .jth-brand-mark {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 950;
    font-size: 20px;
    background: linear-gradient(145deg, var(--jth-emerald), #003e42);
    box-shadow: 0 8px 18px rgba(0,102,106,.18), inset 0 0 0 1px rgba(255,255,255,.22);
    flex: 0 0 auto;
  }

  .jth-kicker {
    color: var(--jth-gold);
    font-size: 8.5px;
    letter-spacing: .11em;
    text-transform: uppercase;
    font-weight: 950;
    line-height: 1;
  }

  h1 {
    margin: 1px 0 0;
    font-size: 20px;
    letter-spacing: -.03em;
    line-height: 1;
  }

  .jth-topbar p { display: none; }

  .jth-actions-top {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
  }

  .jth-sound,
  .jth-refresh {
    min-height: 32px;
    border: 1px solid rgba(0,102,106,.12);
    border-radius: 11px;
    padding: 7px 10px;
    background: rgba(255,255,255,.90);
    color: var(--jth-ink);
    font-weight: 900;
    font-size: 11px;
    cursor: pointer;
    box-shadow: 0 6px 14px rgba(26,47,54,.045);
  }

  .jth-sound {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }

  .jth-sound.is-on {
    color: #fff;
    border-color: transparent;
    background: linear-gradient(135deg, var(--jth-emerald), var(--jth-jade));
  }

  .jth-stats-grid {
    position: relative;
    z-index: 2;
    flex: 0 0 34px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 5px;
  }

  .stat-card {
    position: relative;
    min-height: 34px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,.72);
    background: rgba(255,255,255,.78);
    box-shadow: 0 7px 18px rgba(26,47,54,.045);
    padding: 6px 9px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .stat-card::before { display: none !important; }
  .stat-card::after {
    content: "";
    position: absolute;
    inset-inline-start: 9px;
    bottom: 5px;
    width: 24px;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--jth-gold), transparent);
  }

  .stat-card strong {
    display: inline-block;
    font-size: 16px;
    line-height: 1;
    margin-inline-end: 6px;
  }

  .stat-card span {
    display: inline-block;
    color: var(--jth-muted);
    font-size: 10px;
    font-weight: 850;
    line-height: 1;
  }

  .jth-layout {
    position: relative;
    z-index: 2;
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr) 220px;
    gap: 6px;
    overflow: hidden;
  }

  .jth-layout.details-collapsed {
    grid-template-columns: 260px minmax(0, 1fr) 0;
  }

  .jth-layout.details-collapsed .jth-details-panel { display: none; }

  .jth-sidebar,
  .jth-chat-card,
  .jth-details-panel {
    min-height: 0;
    overflow: hidden;
    border-radius: var(--jth-radius);
    border: 1px solid rgba(255,255,255,.74);
    background: var(--jth-card);
    box-shadow: var(--jth-shadow);
    backdrop-filter: blur(16px);
  }

  .jth-sidebar {
    display: flex;
    flex-direction: column;
  }

  .jth-sidebar-head {
    padding: 8px 9px 5px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 auto;
  }

  .jth-sidebar-head strong { display: block; font-size: 13px; line-height: 1.1; }
  .jth-sidebar-head span { display: block; margin-top: 1px; color: var(--jth-muted); font-size: 10px; font-weight: 800; }

  .jth-wait-badge {
    width: 23px;
    height: 23px;
    border-radius: 9px;
    color: #fff;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #ff7474, var(--jth-danger));
    font-size: 11px;
  }

  .jth-search-box {
    margin: 0 8px 6px;
    padding: 6px 8px;
    border-radius: 12px;
    background: rgba(255,255,255,.75);
    border: 1px solid var(--jth-line);
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 0 0 auto;
  }

  .jth-search-box span { color: var(--jth-gold); font-weight: 950; font-size: 14px; }
  .jth-search-box input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font-size: 11px; font-weight: 750; color: var(--jth-ink); }

  .jth-tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 0 8px 7px;
    border-bottom: 1px solid var(--jth-line);
    flex: 0 0 auto;
  }

  .jth-tabs button {
    border: 1px solid var(--jth-line);
    background: rgba(255,255,255,.65);
    color: var(--jth-muted);
    border-radius: 10px;
    padding: 5px 2px;
    cursor: pointer;
    font-weight: 900;
    font-size: 10px;
  }

  .jth-tabs button.active {
    color: #fff;
    border-color: transparent;
    background: linear-gradient(135deg, var(--jth-emerald), var(--jth-emerald-2));
  }

  .jth-conv-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 6px;
  }

  .jth-conv {
    position: relative;
    width: 100%;
    border: 1px solid rgba(0,102,106,.09);
    background: rgba(255,255,255,.72);
    border-radius: 13px;
    padding: 7px;
    margin-bottom: 6px;
    text-align: right;
    color: var(--jth-ink);
    cursor: pointer;
    box-shadow: 0 5px 14px rgba(26,47,54,.035);
  }

  .jth-conv.active {
    border-color: rgba(201,162,74,.42);
    background: #fff;
  }

  .jth-conv.active::after {
    content: "";
    position: absolute;
    inset-inline-end: 0;
    top: 11px;
    bottom: 11px;
    width: 3px;
    border-radius: 999px;
    background: linear-gradient(180deg, var(--jth-gold), var(--jth-emerald));
  }

  .jth-conv-glow {
    position: absolute;
    top: 8px;
    inset-inline-start: 8px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #9aa8ad;
  }
  .jth-conv-glow.danger { background: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.10); }
  .jth-conv-glow.success { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.10); }
  .jth-conv-glow.ai { background: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,.10); }

  .jth-conv-head,
  .jth-conv-foot,
  .jth-customer-line,
  .jth-chat-buttons,
  .jth-reply-row {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
  }

  .jth-avatar {
    width: 28px;
    height: 28px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: #fff;
    flex: 0 0 auto;
    font-weight: 950;
    background: linear-gradient(145deg, var(--jth-emerald), #06464b);
  }

  .jth-avatar.large { width: 34px; height: 34px; border-radius: 12px; font-size: 15px; }

  .jth-conv-main { min-width: 0; flex: 1; }
  .jth-conv-main strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; line-height: 1.15; }
  .jth-conv-main small { display: block; color: var(--jth-muted); font-weight: 800; font-size: 10px; line-height: 1.1; }

  .jth-conv p { margin: 5px 0; color: #405057; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; font-size: 11px; line-height: 1.2; }
  .jth-conv-foot small { color: var(--jth-muted); font-size: 9px; font-weight: 800; }
  .jth-conv-foot b { min-width: 18px; height: 18px; border-radius: 99px; background: var(--jth-danger); color: #fff; display: inline-grid; place-items: center; font-size: 10px; }

  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 3px 6px;
    font-size: 9px;
    font-weight: 950;
    white-space: nowrap;
  }
  .pill.big { font-size: 10px; padding: 5px 8px; }
  .pill.danger { color: #9f1717; background: #fff0f0; border: 1px solid rgba(207,59,59,.22); }
  .pill.success { color: #087b4b; background: #eafaf1; border: 1px solid rgba(34,197,94,.22); }
  .pill.ai { color: #075985; background: #eef8ff; border: 1px solid rgba(14,165,233,.20); }
  .pill.muted { color: #66737a; background: #f2f4f4; border: 1px solid rgba(148,163,184,.18); }

  .jth-chat-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .jth-chat-head {
    flex: 0 0 46px;
    min-height: 46px;
    padding: 6px 8px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid var(--jth-line);
    background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(255,255,255,.70));
  }

  .jth-chat-title-area { min-width: 0; flex: 1; }
  .jth-customer-line { justify-content: flex-start; min-width: 0; }
  .jth-chat-head h2 { margin: 0; font-size: 15px; line-height: 1.1; max-width: min(32vw, 430px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .jth-chat-head p { margin: 1px 0 0; color: var(--jth-muted); font-size: 10px; font-weight: 750; max-width: min(38vw, 500px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .jth-chat-buttons { flex-wrap: nowrap; flex: 0 0 auto; justify-content: flex-end; }
  .jth-chat-buttons button {
    border: 0;
    border-radius: 10px;
    padding: 6px 8px;
    min-height: 30px;
    color: #fff;
    font-weight: 900;
    cursor: pointer;
    font-size: 10.5px;
    white-space: nowrap;
  }
  .jth-chat-buttons .soft { color: var(--jth-ink); background: #fff; border: 1px solid var(--jth-line); }
  .jth-chat-buttons .close { background: linear-gradient(135deg, var(--jth-emerald), var(--jth-jade)); }
  .jth-chat-buttons .delete { background: linear-gradient(135deg, #9f1d1d, #ef4444); }
  .jth-chat-buttons button:disabled { opacity: .45; cursor: not-allowed; }

  .jth-messages {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 8px 10px;
    scroll-behavior: smooth;
    background: linear-gradient(180deg, rgba(255,255,255,.52), rgba(255,255,255,.20));
  }

  .jth-day-separator {
    width: max-content;
    max-width: 92%;
    margin: 4px auto 8px;
    color: #6c6150;
    background: rgba(255,255,255,.88);
    border: 1px solid rgba(201,162,74,.25);
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 10px;
    font-weight: 900;
  }

  .jth-message-row { display: flex; margin-bottom: 6px; }
  .jth-message-row.customer { justify-content: flex-start; }
  .jth-message-row.ai,
  .jth-message-row.human,
  .jth-message-row.system { justify-content: flex-end; }

  .jth-bubble {
    max-width: min(610px, 70%);
    padding: 7px 9px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,.66);
    box-shadow: 0 7px 16px rgba(26,47,54,.065);
  }
  .jth-message-row.customer .jth-bubble { color: #fff; background: linear-gradient(145deg, var(--jth-emerald), #07464b); border-bottom-right-radius: 5px; }
  .jth-message-row.ai .jth-bubble { background: #fff; color: var(--jth-ink); border-color: rgba(0,102,106,.10); border-bottom-left-radius: 5px; }
  .jth-message-row.human .jth-bubble { color: #fff; background: linear-gradient(145deg, #287e86, #1e5668); border-bottom-left-radius: 5px; }
  .jth-message-row.system .jth-bubble { background: #fff8e8; color: #715b1d; }

  .jth-sender { display: flex; align-items: center; gap: 5px; opacity: .72; font-size: 10px; font-weight: 900; margin-bottom: 3px; }
  .jth-bubble p { white-space: pre-wrap; margin: 0; line-height: 1.5; font-weight: 700; font-size: 12px; }
  .jth-bubble small,
  .jth-bubble time { display: block; margin-top: 4px; color: currentColor; opacity: .62; font-size: 9px; font-weight: 800; }
  .jth-image-link { color: var(--jth-emerald); font-weight: 900; display: inline-block; margin-top: 5px; font-size: 11px; }
  .jth-message-row.customer .jth-image-link,
  .jth-message-row.human .jth-image-link { color: #fff3bf; }

  .jth-reply-panel {
    flex: 0 0 auto;
    border-top: 1px solid var(--jth-line);
    padding: 5px;
    background: rgba(255,255,255,.82);
  }

  .jth-quick-replies {
    display: flex;
    gap: 5px;
    overflow: auto;
    padding-bottom: 4px;
    max-height: 28px;
  }

  .jth-quick-replies button {
    flex: 0 0 auto;
    max-width: 310px;
    border: 1px solid rgba(0,102,106,.10);
    background: #fff;
    color: var(--jth-ink);
    border-radius: 999px;
    padding: 5px 8px;
    cursor: pointer;
    font-weight: 800;
    font-size: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .jth-reply-row { gap: 5px; }
  .jth-reply-row textarea {
    flex: 1;
    min-height: 36px;
    height: 36px;
    max-height: 72px;
    resize: none;
    overflow: auto;
    border: 1px solid rgba(0,102,106,.13);
    background: #fff;
    color: var(--jth-ink);
    border-radius: 12px;
    padding: 8px 10px;
    box-sizing: border-box;
    font-family: inherit;
    outline: none;
    font-weight: 750;
    font-size: 12px;
    line-height: 1.45;
  }
  .jth-reply-row textarea:focus { border-color: rgba(201,162,74,.62); box-shadow: 0 0 0 3px rgba(201,162,74,.10); }
  .jth-reply-row .send,
  .jth-reply-row .emoji {
    height: 36px;
    border: 0;
    border-radius: 12px;
    padding: 0 12px;
    cursor: pointer;
    font-weight: 900;
    font-size: 12px;
    flex: 0 0 auto;
  }
  .jth-reply-row .send { color: #fff; background: linear-gradient(135deg, var(--jth-emerald), var(--jth-jade)); }
  .jth-reply-row .send:disabled { opacity: .48; cursor: not-allowed; }
  .jth-reply-row .emoji { color: var(--jth-ink); background: #fff; border: 1px solid rgba(0,102,106,.11); }

  .jth-emoji-bar { display: flex; gap: 5px; padding-top: 5px; }
  .jth-emoji-bar button { border: 1px solid rgba(0,102,106,.10); background: #fff; border-radius: 10px; padding: 4px 7px; cursor: pointer; }

  .jth-details-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    overflow: auto;
  }

  .jth-detail-card {
    background: rgba(255,255,255,.72);
    border: 1px solid rgba(0,102,106,.09);
    border-radius: 13px;
    padding: 8px;
    box-shadow: 0 7px 16px rgba(26,47,54,.035);
  }
  .jth-detail-card.signature { color: #fff; border: 0; background: linear-gradient(145deg, var(--jth-emerald), #06464b); }
  .mini-label { display: inline-flex; color: #fff3bf; font-size: 10px; font-weight: 900; }
  .jth-detail-card h3,
  .jth-detail-card h4 { margin: 0 0 5px; font-size: 12px; line-height: 1.15; }
  .jth-detail-card p { margin: 0; color: var(--jth-muted); line-height: 1.45; font-weight: 700; font-size: 10.5px; }
  .jth-detail-card.signature p { color: rgba(255,255,255,.78); }
  .jth-detail-card dl { margin: 0; display: grid; gap: 5px; }
  .jth-detail-card dl div { display: flex; justify-content: space-between; gap: 6px; border-bottom: 1px dashed rgba(0,102,106,.11); padding-bottom: 4px; }
  .jth-detail-card dt { color: var(--jth-muted); font-size: 10px; font-weight: 850; }
  .jth-detail-card dd { margin: 0; color: var(--jth-ink); text-align: left; font-weight: 800; word-break: break-word; font-size: 10px; }
  .copy-btn { width: 100%; margin-top: 6px; border: 1px solid rgba(201,162,74,.28); background: #fffaf0; color: #7a5f18; border-radius: 11px; padding: 6px 8px; cursor: pointer; font-weight: 900; font-size: 11px; }
  .team-card { background: linear-gradient(135deg, #fff, #f5fbf8); }
  .team-strip { margin-top: 6px; display: flex; justify-content: space-between; gap: 6px; padding: 6px; border-radius: 10px; background: #edf8f1; color: var(--jth-emerald); font-weight: 850; font-size: 10.5px; }
  .breakable { word-break: break-word; }

  .jth-empty { color: var(--jth-muted); padding: 10px; font-weight: 800; font-size: 12px; }
  .jth-empty.compact { padding: 8px; text-align: center; }
  .jth-empty.center { margin: auto; text-align: center; }

  ::-webkit-scrollbar { width: 7px; height: 7px; }
  ::-webkit-scrollbar-track { background: rgba(0,102,106,.04); border-radius: 999px; }
  ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, rgba(201,162,74,.48), rgba(0,102,106,.42)); border-radius: 999px; border: 2px solid rgba(255,255,255,.55); }

  @media (max-width: 1450px) {
    .jth-layout,
    .jth-layout.details-collapsed { grid-template-columns: 250px minmax(0, 1fr); }
    .jth-details-panel { display: none; }
    .jth-chat-head h2 { max-width: 32vw; }
    .jth-chat-head p { max-width: 40vw; }
  }

  @media (max-height: 740px) and (min-width: 981px) {
    .jth-admin-shell { padding: 5px; gap: 4px; }
    .jth-topbar { flex: 0 0 36px; min-height: 36px; }
    .jth-brand-mark { width: 32px; height: 32px; border-radius: 10px; font-size: 18px; }
    h1 { font-size: 18px; }
    .jth-kicker { font-size: 8px; }
    .jth-sound, .jth-refresh { min-height: 28px; padding: 5px 8px; font-size: 10px; }
    .jth-stats-grid { flex-basis: 28px; gap: 4px; }
    .stat-card { min-height: 28px; padding: 5px 8px; border-radius: 10px; }
    .stat-card strong { font-size: 14px; }
    .stat-card span { font-size: 9px; }
    .jth-chat-head { flex-basis: 40px; min-height: 40px; padding: 5px 7px; }
    .jth-chat-buttons button { min-height: 27px; padding: 5px 7px; font-size: 10px; }
    .jth-messages { padding: 6px 9px; }
    .jth-bubble { padding: 6px 8px; }
    .jth-bubble p { font-size: 11.5px; line-height: 1.42; }
    .jth-reply-panel { padding: 4px; }
    .jth-quick-replies { max-height: 24px; padding-bottom: 3px; }
    .jth-quick-replies button { padding: 4px 7px; font-size: 9px; }
    .jth-reply-row textarea { height: 32px; min-height: 32px; font-size: 11px; padding: 6px 9px; }
    .jth-reply-row .send, .jth-reply-row .emoji { height: 32px; font-size: 11px; }
  }

  @media (max-width: 980px) {
    html, body { overflow: auto !important; }
    .jth-admin-shell { height: auto; min-height: 100dvh; overflow: visible; padding: 6px; }
    .jth-topbar { flex: 0 0 auto; min-height: 40px; }
    .jth-layout,
    .jth-layout.details-collapsed { grid-template-columns: 1fr; height: auto; overflow: visible; }
    .jth-sidebar { height: 30dvh; min-height: 210px; }
    .jth-chat-card { height: 66dvh; min-height: 430px; }
    .jth-details-panel { display: none; }
    .jth-stats-grid { grid-template-columns: repeat(4, minmax(86px, 1fr)); overflow-x: auto; flex: 0 0 32px; padding-bottom: 1px; }
    .stat-card { min-width: 86px; }
    .jth-actions-top { justify-content: stretch; }
    .jth-actions-top button { flex: 1; }
    .jth-chat-head { flex-direction: column; align-items: stretch; height: auto; flex-basis: auto; min-height: 0; }
    .jth-chat-head h2, .jth-chat-head p { max-width: 100%; }
    .jth-chat-buttons { display: grid; grid-template-columns: repeat(3, 1fr); }
    .jth-chat-buttons button { width: 100%; }
    .jth-bubble { max-width: 88%; }
  }

  @media (max-width: 640px) {
    .jth-admin-shell { padding: 5px; gap: 4px; }
    .jth-brand-mark { width: 34px; height: 34px; }
    .jth-kicker { display: none; }
    h1 { font-size: 18px; }
    .jth-sound, .jth-refresh { padding: 7px 7px; font-size: 10px; }
    .jth-stats-grid { gap: 4px; }
    .stat-card { padding: 5px 7px; border-radius: 11px; }
    .jth-sidebar { height: 28dvh; min-height: 200px; border-radius: 13px; }
    .jth-chat-card { height: 67dvh; min-height: 420px; border-radius: 13px; }
    .jth-tabs { gap: 3px; padding-inline: 6px; }
    .jth-tabs button { font-size: 9px; padding: 5px 1px; }
    .jth-conv-list { padding: 5px; }
    .jth-conv { padding: 6px; border-radius: 12px; }
    .pill.big { display: none; }
    .jth-chat-buttons { grid-template-columns: 1fr 1fr; }
    .jth-chat-buttons .soft { grid-column: 1 / -1; }
    .jth-messages { padding: 7px; }
    .jth-bubble { max-width: 93%; padding: 7px 9px; }
    .jth-bubble p { font-size: 12px; line-height: 1.55; }
    .jth-quick-replies button { max-width: 230px; }
    .jth-reply-row { gap: 4px; }
    .jth-reply-row textarea { min-height: 35px; height: 35px; font-size: 11.5px; border-radius: 11px; }
    .jth-reply-row .send, .jth-reply-row .emoji { height: 35px; border-radius: 11px; padding-inline: 10px; }
    .jth-toast { left: 6px; right: 6px; bottom: 6px; text-align: center; }
  }
`;

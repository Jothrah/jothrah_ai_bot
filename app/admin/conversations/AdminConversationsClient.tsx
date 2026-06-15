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
    --jth-bg: #f8f5ee;
    --jth-bg-2: #fffdf8;
    --jth-card: rgba(255, 255, 255, .82);
    --jth-card-solid: #ffffff;
    --jth-ink: #12313a;
    --jth-muted: #718189;
    --jth-soft: #edf3f1;
    --jth-line: rgba(18, 49, 58, .10);
    --jth-emerald: #00666a;
    --jth-emerald-2: #00866f;
    --jth-jade: #1bbf7a;
    --jth-gold: #c9a24a;
    --jth-gold-2: #f3df9b;
    --jth-danger: #cf3b3b;
    --jth-shadow: 0 22px 70px rgba(26, 47, 54, .13);
  }

  html, body {
    margin: 0;
    background: var(--jth-bg) !important;
  }

  body {
    overflow: hidden;
  }

  button, input, textarea {
    font-family: inherit;
  }

  .jth-admin-shell {
    min-height: 100vh;
    height: 100vh;
    overflow: hidden;
    padding: 18px;
    color: var(--jth-ink);
    background:
      radial-gradient(circle at 12% 8%, rgba(255, 232, 165, .55), transparent 28%),
      radial-gradient(circle at 82% 5%, rgba(28, 191, 122, .16), transparent 32%),
      radial-gradient(circle at 70% 90%, rgba(0, 102, 106, .14), transparent 33%),
      linear-gradient(135deg, #fbf7ef 0%, #f4faf7 52%, #fffaf1 100%);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .jth-admin-shell::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(0, 102, 106, .035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 102, 106, .035) 1px, transparent 1px);
    background-size: 42px 42px;
    mask-image: linear-gradient(to bottom, rgba(0,0,0,.65), transparent 78%);
  }

  .jth-topbar {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: center;
    margin-bottom: 12px;
  }

  .jth-brand-card {
    display: flex;
    gap: 14px;
    align-items: center;
  }

  .jth-brand-mark {
    width: 56px;
    height: 56px;
    border-radius: 20px;
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 950;
    font-size: 28px;
    background:
      linear-gradient(135deg, rgba(255,255,255,.32), transparent),
      linear-gradient(145deg, var(--jth-emerald), #003f43);
    box-shadow: 0 16px 40px rgba(0, 102, 106, .28), inset 0 0 0 1px rgba(255,255,255,.24);
  }

  .jth-kicker {
    color: var(--jth-gold);
    font-size: 11px;
    letter-spacing: .14em;
    text-transform: uppercase;
    font-weight: 950;
  }

  h1 {
    margin: 4px 0 3px;
    font-size: clamp(24px, 2vw, 34px);
    letter-spacing: -.03em;
  }

  .jth-topbar p {
    margin: 0;
    color: var(--jth-muted);
    font-weight: 650;
  }

  .jth-actions-top {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .jth-sound, .jth-refresh {
    border: 1px solid rgba(0, 102, 106, .14);
    color: var(--jth-ink);
    background: rgba(255,255,255,.78);
    border-radius: 18px;
    padding: 12px 14px;
    cursor: pointer;
    font-weight: 950;
    box-shadow: 0 12px 34px rgba(26, 47, 54, .08);
    transition: .18s ease;
  }

  .jth-sound:hover, .jth-refresh:hover {
    transform: translateY(-1px);
    border-color: rgba(201, 162, 74, .42);
  }

  .jth-sound {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .jth-sound.is-on {
    background: linear-gradient(135deg, var(--jth-emerald), var(--jth-jade));
    color: #fff;
    border-color: transparent;
  }

  .jth-stats-grid {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .stat-card {
    position: relative;
    overflow: hidden;
    background: var(--jth-card);
    border: 1px solid rgba(255,255,255,.72);
    border-radius: 22px;
    padding: 13px 15px;
    box-shadow: var(--jth-shadow);
    backdrop-filter: blur(18px);
  }

  .stat-card::after {
    content: "";
    position: absolute;
    inset-inline-start: 14px;
    bottom: 11px;
    width: 46px;
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--jth-gold), transparent);
  }

  .stat-card.hot::before,
  .stat-card.jade::before,
  .stat-card.mist::before,
  .stat-card.pearl::before {
    content: "";
    position: absolute;
    inset: -55px auto auto -40px;
    width: 120px;
    height: 120px;
    border-radius: 999px;
    background: rgba(201, 162, 74, .22);
  }

  .stat-card.hot::before { background: rgba(207, 59, 59, .16); }
  .stat-card.jade::before { background: rgba(27, 191, 122, .18); }
  .stat-card.mist::before { background: rgba(0, 102, 106, .13); }

  .stat-card strong {
    display:block;
    font-size: 26px;
    line-height: 1;
  }

  .stat-card span {
    display:block;
    color: var(--jth-muted);
    font-size: 13px;
    margin-top: 7px;
    font-weight: 800;
  }

  .jth-layout {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 345px minmax(0, 1fr) 310px;
    gap: 12px;
    height: calc(100vh - 174px);
    min-height: 520px;
  }

  .jth-layout.details-collapsed {
    grid-template-columns: 345px minmax(0, 1fr) 0px;
  }

  .jth-layout.details-collapsed .jth-details-panel {
    display: none;
  }

  .jth-sidebar, .jth-chat-card, .jth-details-panel {
    border: 1px solid rgba(255,255,255,.78);
    background: var(--jth-card);
    backdrop-filter: blur(22px);
    border-radius: 28px;
    overflow: hidden;
    box-shadow: var(--jth-shadow);
  }

  .jth-sidebar {
    display:flex;
    flex-direction: column;
  }

  .jth-sidebar-head {
    display:flex;
    justify-content: space-between;
    align-items:center;
    padding: 15px 15px 10px;
  }

  .jth-sidebar-head strong {
    display:block;
    font-size: 16px;
  }

  .jth-sidebar-head span {
    display:block;
    color: var(--jth-muted);
    font-size: 12px;
    font-weight: 800;
    margin-top: 4px;
  }

  .jth-wait-badge {
    width: 31px;
    height: 31px;
    border-radius: 12px;
    display:grid;
    place-items:center;
    background: linear-gradient(135deg, #ff7a7a, var(--jth-danger));
    color:#fff;
    box-shadow: 0 14px 24px rgba(207, 59, 59, .24);
  }

  .jth-search-box {
    display:flex;
    align-items:center;
    gap: 9px;
    margin: 0 12px 10px;
    padding: 10px 12px;
    border-radius: 18px;
    background: rgba(255,255,255,.72);
    border: 1px solid var(--jth-line);
  }

  .jth-search-box span {
    color: var(--jth-gold);
    font-weight: 950;
    font-size: 20px;
  }

  .jth-search-box input {
    flex:1;
    border:0;
    outline:0;
    background:transparent;
    color: var(--jth-ink);
    font-weight: 750;
    min-width: 0;
  }

  .jth-tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7px;
    padding: 0 12px 12px;
    border-bottom: 1px solid var(--jth-line);
  }

  .jth-tabs button {
    border: 1px solid var(--jth-line);
    background: rgba(255,255,255,.62);
    color: var(--jth-muted);
    border-radius: 14px;
    padding: 9px 6px;
    cursor:pointer;
    font-weight: 950;
    font-size: 12px;
    transition:.18s ease;
  }

  .jth-tabs button.active {
    background: linear-gradient(135deg, var(--jth-emerald), var(--jth-emerald-2));
    color:#fff;
    border-color: transparent;
    box-shadow: 0 12px 24px rgba(0, 102, 106, .18);
  }

  .jth-conv-list {
    padding: 12px;
    overflow:auto;
  }

  .jth-conv {
    position: relative;
    width:100%;
    text-align:right;
    border:1px solid rgba(0, 102, 106, .10);
    color: var(--jth-ink);
    background: rgba(255,255,255,.72);
    border-radius: 22px;
    padding: 12px;
    margin-bottom: 10px;
    cursor:pointer;
    transition:.18s ease;
    box-shadow: 0 10px 26px rgba(26,47,54,.06);
  }

  .jth-conv:hover,
  .jth-conv.active {
    transform: translateY(-1px);
    border-color: rgba(201, 162, 74, .48);
    background: #fff;
    box-shadow: 0 17px 35px rgba(26,47,54,.10);
  }

  .jth-conv.active::after {
    content:"";
    position:absolute;
    inset-inline-end: 0;
    top: 18px;
    bottom: 18px;
    width: 4px;
    border-radius: 999px;
    background: linear-gradient(180deg, var(--jth-gold), var(--jth-emerald));
  }

  .jth-conv-glow {
    position:absolute;
    top: 12px;
    inset-inline-start: 12px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #9aa8ad;
  }

  .jth-conv-glow.danger { background: #ef4444; box-shadow: 0 0 0 5px rgba(239, 68, 68, .12); }
  .jth-conv-glow.success { background: #22c55e; box-shadow: 0 0 0 5px rgba(34, 197, 94, .12); }
  .jth-conv-glow.ai { background: #0ea5e9; box-shadow: 0 0 0 5px rgba(14, 165, 233, .12); }

  .jth-conv-head, .jth-conv-foot, .jth-customer-line, .jth-chat-buttons, .jth-reply-row {
    display:flex;
    align-items:center;
    gap:10px;
    justify-content:space-between;
  }

  .jth-avatar {
    width: 37px;
    height: 37px;
    border-radius: 15px;
    display:grid;
    place-items:center;
    color:#fff;
    flex: 0 0 auto;
    font-weight: 950;
    background:
      linear-gradient(135deg, rgba(255,255,255,.30), transparent),
      linear-gradient(145deg, var(--jth-emerald), #06464b);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.22);
  }

  .jth-avatar.large {
    width: 52px;
    height: 52px;
    border-radius: 19px;
    font-size: 21px;
  }

  .jth-conv-main {
    min-width: 0;
    flex: 1;
  }

  .jth-conv-main strong {
    display:block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .jth-conv-main small {
    color: var(--jth-muted);
    font-weight: 800;
  }

  .jth-conv p {
    margin: 9px 0;
    color:#405057;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    font-weight: 700;
  }

  .jth-conv-foot small {
    color: var(--jth-muted);
    font-size: 11px;
    font-weight: 800;
  }

  .jth-conv-foot b {
    min-width: 22px;
    height: 22px;
    border-radius: 99px;
    background: var(--jth-danger);
    color:#fff;
    display:inline-grid;
    place-items:center;
    font-size:12px;
  }

  .pill {
    display:inline-flex;
    align-items:center;
    justify-content:center;
    border-radius:999px;
    padding: 5px 9px;
    font-size: 11px;
    font-weight: 950;
    white-space: nowrap;
  }

  .pill.big {
    font-size: 12px;
    padding: 7px 12px;
  }

  .pill.danger { color:#9f1717; background:#fff0f0; border:1px solid rgba(207,59,59,.24); }
  .pill.success { color:#087b4b; background:#eafaf1; border:1px solid rgba(34,197,94,.24); }
  .pill.ai { color:#075985; background:#eef8ff; border:1px solid rgba(14,165,233,.22); }
  .pill.muted { color:#66737a; background:#f2f4f4; border:1px solid rgba(148,163,184,.20); }

  .jth-chat-card {
    display:flex;
    flex-direction:column;
  }

  .jth-chat-head {
    padding: 14px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:14px;
    border-bottom:1px solid var(--jth-line);
    background:
      linear-gradient(135deg, rgba(255,255,255,.92), rgba(255,255,255,.68)),
      linear-gradient(90deg, rgba(201,162,74,.14), transparent);
  }

  .jth-chat-title-area {
    min-width: 0;
  }

  .jth-customer-line {
    justify-content:flex-start;
  }

  .jth-chat-head h2 {
    margin:0;
    font-size: clamp(18px, 1.5vw, 24px);
    letter-spacing: -.02em;
  }

  .jth-chat-head p {
    margin:5px 0 0;
    color: var(--jth-muted);
    font-size: 13px;
    font-weight: 750;
  }

  .jth-chat-buttons {
    flex-wrap: wrap;
    justify-content:flex-end;
  }

  .jth-chat-buttons button {
    border:0;
    border-radius:16px;
    padding: 11px 13px;
    color:#fff;
    font-weight:950;
    cursor:pointer;
    transition:.18s ease;
  }

  .jth-chat-buttons button:hover { transform: translateY(-1px); }
  .jth-chat-buttons .soft { color: var(--jth-ink); background:#fff; border:1px solid var(--jth-line); }
  .jth-chat-buttons .close { background: linear-gradient(135deg, var(--jth-emerald), var(--jth-jade)); }
  .jth-chat-buttons .delete { background: linear-gradient(135deg, #9f1d1d, #ef4444); }
  .jth-chat-buttons button:disabled { opacity:.45; cursor:not-allowed; transform:none; }

  .jth-messages {
    flex:1;
    overflow:auto;
    padding: 18px 22px;
    scroll-behavior: smooth;
    background:
      radial-gradient(circle at 20% 0%, rgba(201,162,74,.12), transparent 25%),
      linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,.18));
  }

  .jth-day-separator {
    width:max-content;
    max-width: 92%;
    margin: 10px auto 16px;
    color: #6c6150;
    background: rgba(255,255,255,.82);
    border:1px solid rgba(201,162,74,.28);
    border-radius:999px;
    padding: 7px 13px;
    font-size: 12px;
    font-weight: 950;
    box-shadow: 0 12px 22px rgba(26,47,54,.06);
  }

  .jth-message-row {
    display:flex;
    margin-bottom: 12px;
  }

  .jth-message-row.customer { justify-content:flex-start; }
  .jth-message-row.ai, .jth-message-row.human, .jth-message-row.system { justify-content:flex-end; }

  .jth-bubble {
    max-width:min(720px, 73%);
    padding: 12px 14px;
    border-radius: 22px;
    border:1px solid rgba(255,255,255,.72);
    box-shadow: 0 16px 34px rgba(26,47,54,.10);
  }

  .jth-message-row.customer .jth-bubble {
    color:#fff;
    background:
      linear-gradient(135deg, rgba(255,255,255,.12), transparent),
      linear-gradient(145deg, var(--jth-emerald), #07464b);
    border-bottom-right-radius: 7px;
  }

  .jth-message-row.ai .jth-bubble {
    background: #fff;
    color: var(--jth-ink);
    border-color: rgba(0,102,106,.12);
    border-bottom-left-radius: 7px;
  }

  .jth-message-row.human .jth-bubble {
    color:#fff;
    background:
      linear-gradient(135deg, rgba(255,255,255,.18), transparent),
      linear-gradient(145deg, #287e86, #1e5668);
    border-bottom-left-radius: 7px;
  }

  .jth-message-row.system .jth-bubble {
    background:#fff8e8;
    color:#715b1d;
  }

  .jth-sender {
    display:flex;
    align-items:center;
    gap:7px;
    color: inherit;
    opacity:.72;
    font-size:12px;
    font-weight:950;
    margin-bottom: 6px;
  }

  .jth-bubble p {
    white-space:pre-wrap;
    margin:0;
    line-height:1.85;
    font-weight: 750;
  }

  .jth-bubble small, .jth-bubble time {
    display:block;
    margin-top:8px;
    color: currentColor;
    opacity:.62;
    font-size:11px;
    font-weight: 800;
  }

  .jth-image-link {
    color: var(--jth-emerald);
    font-weight:950;
    display:inline-block;
    margin-top:8px;
  }

  .jth-message-row.customer .jth-image-link,
  .jth-message-row.human .jth-image-link {
    color:#fff3bf;
  }

  .jth-reply-panel {
    border-top:1px solid var(--jth-line);
    padding: 12px;
    background: rgba(255,255,255,.72);
  }

  .jth-quick-replies {
    display:flex;
    gap:8px;
    overflow:auto;
    padding-bottom: 9px;
  }

  .jth-quick-replies button {
    flex:0 0 auto;
    border:1px solid rgba(0,102,106,.12);
    background:#fff;
    color: var(--jth-ink);
    border-radius: 999px;
    padding: 8px 11px;
    cursor:pointer;
    font-weight: 850;
    box-shadow: 0 8px 18px rgba(26,47,54,.05);
  }

  .jth-reply-row textarea {
    flex:1;
    min-height:54px;
    max-height:130px;
    resize:vertical;
    border:1px solid rgba(0,102,106,.14);
    background:#fff;
    color: var(--jth-ink);
    border-radius:18px;
    padding: 13px;
    font-family:inherit;
    outline:none;
    font-weight: 750;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.65);
  }

  .jth-reply-row textarea:focus {
    border-color: rgba(201,162,74,.70);
    box-shadow: 0 0 0 4px rgba(201,162,74,.12);
  }

  .jth-reply-row .send, .jth-reply-row .emoji {
    border:0;
    border-radius:18px;
    height:54px;
    padding:0 18px;
    cursor:pointer;
    font-weight:950;
  }

  .jth-reply-row .send {
    color:#fff;
    background:linear-gradient(135deg, var(--jth-emerald), var(--jth-jade));
    box-shadow: 0 14px 28px rgba(0,102,106,.18);
  }

  .jth-reply-row .send:disabled {
    opacity: .48;
    cursor: not-allowed;
  }

  .jth-reply-row .emoji {
    color: var(--jth-ink);
    background:#fff;
    border:1px solid rgba(0,102,106,.12);
  }

  .jth-emoji-bar {
    display:flex;
    gap:8px;
    padding-top:10px;
  }

  .jth-emoji-bar button {
    border:1px solid rgba(0,102,106,.10);
    background:#fff;
    border-radius:14px;
    padding: 8px 10px;
    cursor:pointer;
  }

  .jth-details-panel {
    display:flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    overflow:auto;
  }

  .jth-detail-card {
    background: rgba(255,255,255,.74);
    border: 1px solid rgba(0,102,106,.10);
    border-radius: 22px;
    padding: 14px;
    box-shadow: 0 12px 26px rgba(26,47,54,.06);
  }

  .jth-detail-card.signature {
    color: #fff;
    border: 0;
    background:
      linear-gradient(135deg, rgba(255,255,255,.18), transparent),
      linear-gradient(145deg, var(--jth-emerald), #06464b);
  }

  .mini-label {
    display:inline-flex;
    color: #fff3bf;
    font-size: 12px;
    font-weight: 950;
  }

  .jth-detail-card h3,
  .jth-detail-card h4 {
    margin: 0 0 8px;
  }

  .jth-detail-card p {
    margin: 0;
    color: var(--jth-muted);
    line-height: 1.7;
    font-weight: 720;
  }

  .jth-detail-card.signature p {
    color: rgba(255,255,255,.78);
  }

  .jth-detail-card dl {
    margin:0;
    display:grid;
    gap: 10px;
  }

  .jth-detail-card dl div {
    display:flex;
    justify-content:space-between;
    gap:10px;
    border-bottom:1px dashed rgba(0,102,106,.12);
    padding-bottom:8px;
  }

  .jth-detail-card dt {
    color: var(--jth-muted);
    font-size: 12px;
    font-weight: 900;
  }

  .jth-detail-card dd {
    margin:0;
    color: var(--jth-ink);
    text-align:left;
    font-weight: 850;
    word-break: break-word;
  }

  .copy-btn {
    width: 100%;
    margin-top: 12px;
    border: 1px solid rgba(201,162,74,.32);
    background: #fffaf0;
    color: #7a5f18;
    border-radius: 16px;
    padding: 10px 12px;
    cursor:pointer;
    font-weight: 950;
  }

  .team-card {
    background: linear-gradient(135deg, #fff, #f5fbf8);
  }

  .team-strip {
    margin-top: 12px;
    display:flex;
    justify-content:space-between;
    gap:10px;
    padding: 10px;
    border-radius: 16px;
    background: #edf8f1;
    color: var(--jth-emerald);
    font-weight: 900;
  }

  .breakable {
    word-break: break-word;
  }

  .jth-toast {
    position:fixed;
    z-index:9999;
    left:24px;
    bottom:24px;
    background:rgba(0,102,106,.96);
    color:#fff;
    border:1px solid rgba(255,255,255,.40);
    border-radius:20px;
    padding:14px 16px;
    box-shadow:0 22px 60px rgba(0,102,106,.24);
    font-weight:950;
  }

  .jth-empty {
    color: var(--jth-muted);
    padding: 18px;
    font-weight: 850;
  }

  .jth-empty.compact {
    padding: 12px;
    text-align:center;
  }

  .jth-empty.center {
    margin:auto;
    text-align:center;
  }

  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(0,102,106,.05);
    border-radius: 999px;
  }

  ::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(201,162,74,.55), rgba(0,102,106,.45));
    border-radius: 999px;
    border: 2px solid rgba(255,255,255,.5);
  }

  @media (max-width: 1220px) {
    .jth-layout,
    .jth-layout.details-collapsed {
      grid-template-columns: 330px minmax(0,1fr);
    }
    .jth-details-panel { display:none; }
  }

  @media (max-width: 980px) {
    body { overflow: auto; }
    .jth-admin-shell { height:auto; overflow:visible; padding: 12px; }
    .jth-layout,
    .jth-layout.details-collapsed {
      grid-template-columns: 1fr;
      height:auto;
      min-height: auto;
    }
    .jth-sidebar, .jth-chat-card { min-height: 460px; }
    .jth-chat-card { height: 70vh; }
    .jth-stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .jth-topbar { flex-direction: column; align-items: stretch; }
    .jth-actions-top { justify-content: stretch; }
    .jth-actions-top button { flex:1; }
    .jth-chat-head { flex-direction: column; align-items: stretch; }
    .jth-chat-buttons { justify-content: stretch; }
    .jth-chat-buttons button { flex:1; }
    .jth-bubble { max-width: 88%; }
  }
`;

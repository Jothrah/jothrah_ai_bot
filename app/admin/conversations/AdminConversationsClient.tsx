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
  "اتبع تعليمات ملصق المنتج دائمًا ولا تستخدم أي مبيد قرب الأطفال أو الحيوانات أو الطعام.",
];

function formatDateTime(value?: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Riyadh",
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
      timeZone: "Asia/Riyadh",
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
      timeZone: "Asia/Riyadh",
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

  if (status === "needs_human" || conversation?.needs_human)
    return "بانتظار مختص";
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
    conversation.language,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes(query.trim().toLowerCase());
}

function playLuxuryNotify() {
  try {
    const AudioContextCtor =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const gain = ctx.createGain();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();

    o1.type = "sine";
    o2.type = "triangle";
    o1.frequency.setValueAtTime(659, ctx.currentTime);
    o2.frequency.setValueAtTime(880, ctx.currentTime + 0.07);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

    o1.connect(gain);
    o2.connect(gain);
    gain.connect(ctx.destination);

    o1.start(ctx.currentTime);
    o1.stop(ctx.currentTime + 0.14);
    o2.start(ctx.currentTime + 0.08);
    o2.stop(ctx.currentTime + 0.3);

    setTimeout(() => ctx.close?.(), 480);
  } catch {}
}

export default function AdminConversationsClient({ initialData }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>(
    initialData.conversations || [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialData.selectedId || null,
  );
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(initialData.selectedConversation || null);
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialData.messages || [],
  );
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "waiting" | "open" | "closed">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const lastSeenCustomerMessageId = useRef<string | null>(null);
  const lastTotalUnreadRef = useRef<number>(
    (initialData.conversations || []).reduce(
      (sum, item) => sum + (Number(item.unread_admin_count || 0) || 0),
      0,
    ),
  );
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const stats = useMemo(() => {
    const waiting = conversations.filter(
      (item) => item.status === "needs_human" || item.needs_human,
    ).length;
    const unread = conversations.reduce(
      (sum, item) => sum + (Number(item.unread_admin_count || 0) || 0),
      0,
    );
    const closed = conversations.filter(
      (item) => item.status === "closed",
    ).length;
    const open = conversations.filter(
      (item) => item.status !== "closed",
    ).length;

    return { waiting, unread, closed, open, total: conversations.length };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    let items = conversations;

    if (filter === "waiting")
      items = items.filter(
        (item) => item.status === "needs_human" || item.needs_human,
      );
    if (filter === "open")
      items = items.filter((item) => item.status !== "closed");
    if (filter === "closed")
      items = items.filter((item) => item.status === "closed");
    if (query.trim())
      items = items.filter((conversation) =>
        conversationMatches(conversation, query),
      );

    return items;
  }, [conversations, filter, query]);

  const scrollToBottom = useCallback(() => {
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ block: "end" }),
      25,
    );
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ block: "end" }),
      130,
    );
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedId, scrollToBottom]);

  useEffect(() => {
    document.title =
      stats.waiting > 0 ? `(${stats.waiting}) محادثات جذرة` : "محادثات جذرة";
  }, [stats.waiting]);

  const flashToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2800);
  }, []);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const id = selectedIdRef.current;
      const url = id
        ? `/api/admin/conversations?id=${encodeURIComponent(id)}`
        : "/api/admin/conversations";

      try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "تعذر تحديث المحادثات");

        const nextConversations = data.conversations || [];
        const nextMessages = data.messages || [];
        const nextSelected = data.selectedConversation || null;
        const nextTotalUnread = nextConversations.reduce(
          (sum: number, item: Conversation) =>
            sum + (Number(item.unread_admin_count || 0) || 0),
          0,
        );
        const newestCustomer = [...nextMessages]
          .reverse()
          .find((msg) => msg.sender_type === "customer");
        const selectedHasNewCustomer =
          Boolean(newestCustomer?.id) &&
          Boolean(lastSeenCustomerMessageId.current) &&
          newestCustomer.id !== lastSeenCustomerMessageId.current;
        const hasNewUnread = nextTotalUnread > lastTotalUnreadRef.current;

        if (soundEnabled && (selectedHasNewCustomer || hasNewUnread)) {
          playLuxuryNotify();
          flashToast("رسالة جديدة وصلت ✨");
        }

        if (newestCustomer?.id)
          lastSeenCustomerMessageId.current = newestCustomer.id;
        lastTotalUnreadRef.current = nextTotalUnread;

        setConversations(nextConversations);
        setSelectedConversation(nextSelected);
        setMessages(nextMessages);
        scrollToBottom();
      } catch (error) {
        if (!options?.silent)
          flashToast(
            error instanceof Error ? error.message : "حدث خطأ أثناء التحديث",
          );
      }
    },
    [flashToast, scrollToBottom, soundEnabled],
  );

  useEffect(() => {
    const newestCustomer = [...messages]
      .reverse()
      .find((msg) => msg.sender_type === "customer");
    if (newestCustomer?.id)
      lastSeenCustomerMessageId.current = newestCustomer.id;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => refresh({ silent: true }), 2200);
    return () => clearInterval(timer);
  }, [refresh]);

  async function selectConversation(id: string) {
    setSelectedId(id);
    window.history.replaceState(null, "", `/admin/conversations?id=${id}`);

    try {
      const res = await fetch(
        `/api/admin/conversations?id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "تعذر فتح المحادثة");
      setConversations(data.conversations || []);
      setSelectedConversation(data.selectedConversation || null);
      setMessages(data.messages || []);
      const newestCustomer = [...(data.messages || [])]
        .reverse()
        .find((msg: ChatMessage) => msg.sender_type === "customer");
      if (newestCustomer?.id)
        lastSeenCustomerMessageId.current = newestCustomer.id;
      lastTotalUnreadRef.current = (data.conversations || []).reduce(
        (sum: number, item: Conversation) =>
          sum + (Number(item.unread_admin_count || 0) || 0),
        0,
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
        body: JSON.stringify({ message }),
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
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "تعذر إنهاء المحادثة");
      flashToast("تم إنهاء المحادثة وإرسال التقييم للعميل ✅");
      await refresh({ silent: true });
    } catch (error) {
      flashToast(
        error instanceof Error ? error.message : "تعذر إنهاء المحادثة",
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation() {
    if (!selectedId || loading) return;
    const name = getCustomerName(selectedConversation);
    if (!confirm(`حذف ${name} نهائيًا من قاعدة البيانات؟ لا يمكن التراجع.`))
      return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/conversations/${selectedId}/delete`, {
        method: "DELETE",
      });
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
      `آخر رسالة: ${formatDateTime(selectedConversation.last_message_at)}`,
    ].join("\n");

    navigator.clipboard?.writeText(text).then(
      () => flashToast("تم نسخ بيانات المحادثة ✨"),
      () => flashToast("تعذر النسخ من المتصفح"),
    );
  }

  let lastDay = "";

  return (
    <main className="jth-desk" dir="rtl">
      <style jsx global>
        {styles}
      </style>
      {toast ? <div className="jth-toast">{toast}</div> : null}

      <header className="desk-top">
        <div className="brand-mini">
          <span className="brand-logo">ج</span>
          <div>
            <b>محادثات جذرة</b>
            <small>Client Care Suite</small>
          </div>
        </div>

        <div className="metric-strip" aria-label="إحصائيات المحادثات">
          <span>
            <b>{stats.total}</b> الكل
          </span>
          <span className={stats.waiting ? "warn" : ""}>
            <b>{stats.waiting}</b> ينتظر
          </span>
          <span className={stats.unread ? "hot" : ""}>
            <b>{stats.unread}</b> جديد
          </span>
          <span>
            <b>{stats.closed}</b> مغلق
          </span>
        </div>

        <div className="top-actions">
          <button
            type="button"
            className={soundEnabled ? "top-btn sound on" : "top-btn sound"}
            onClick={() => {
              setSoundEnabled(true);
              playLuxuryNotify();
              flashToast("تم تفعيل صوت التنبيهات ✅");
            }}
          >
            🔔 {soundEnabled ? "الصوت مفعل" : "تفعيل الصوت"}
          </button>
          <button type="button" className="top-btn" onClick={() => refresh()}>
            تحديث
          </button>
        </div>
      </header>

      <section className={detailsOpen ? "desk-grid show-details" : "desk-grid"}>
        <aside className="inbox-panel">
          <div className="panel-head">
            <strong>صندوق المحادثات</strong>
            {stats.waiting > 0 ? <em>{stats.waiting}</em> : null}
          </div>

          <label className="search-line">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="بحث بالاسم أو آخر رسالة"
            />
          </label>

          <nav className="filters">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              الكل
            </button>
            <button
              className={filter === "waiting" ? "active" : ""}
              onClick={() => setFilter("waiting")}
            >
              ينتظر
            </button>
            <button
              className={filter === "open" ? "active" : ""}
              onClick={() => setFilter("open")}
            >
              نشط
            </button>
            <button
              className={filter === "closed" ? "active" : ""}
              onClick={() => setFilter("closed")}
            >
              مغلق
            </button>
          </nav>

          <div className="conversation-list">
            {filteredConversations.length === 0 ? (
              <div className="empty small">لا توجد محادثات هنا.</div>
            ) : (
              filteredConversations.map((conversation) => {
                const active = conversation.id === selectedId;
                const tone = statusTone(conversation);
                const unread =
                  Number(conversation.unread_admin_count || 0) || 0;

                return (
                  <button
                    type="button"
                    key={conversation.id}
                    className={
                      active ? "conversation-card active" : "conversation-card"
                    }
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <span className={`status-dot ${tone}`} />
                    <span className="avatar">
                      {String(getCustomerName(conversation)).slice(0, 1)}
                    </span>
                    <span className="conversation-content">
                      <span className="conversation-title">
                        <strong>{getCustomerName(conversation)}</strong>
                        <time>
                          {formatTime(conversation.last_message_at) || "—"}
                        </time>
                      </span>
                      <span className="conversation-preview">
                        {conversation.last_message || "بدون رسالة"}
                      </span>
                      <span className="conversation-meta">
                        <small className={`mini-pill ${tone}`}>
                          {statusLabel(conversation)}
                        </small>
                        <small>
                          {formatDateTime(conversation.last_message_at)}
                        </small>
                      </span>
                    </span>
                    {unread > 0 ? (
                      <b className="unread">{unread > 9 ? "9+" : unread}</b>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="chat-panel">
          {selectedConversation ? (
            <>
              <div className="chat-head">
                <div className="chat-user">
                  <span className="avatar lg">
                    {String(getCustomerName(selectedConversation)).slice(0, 1)}
                  </span>
                  <div>
                    <h2>{getCustomerName(selectedConversation)}</h2>
                    <p>
                      {selectedConversation.language || "ar"} ·{" "}
                      {formatDateTime(selectedConversation.last_message_at) ||
                        "آخر نشاط غير متوفر"}
                    </p>
                  </div>
                  <span
                    className={`mini-pill large ${statusTone(selectedConversation)}`}
                  >
                    {statusLabel(selectedConversation)}
                  </span>
                </div>

                <div className="chat-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setDetailsOpen((value) => !value)}
                  >
                    {detailsOpen ? "إخفاء الملف" : "ملف العميل"}
                  </button>
                  <button
                    type="button"
                    className="finish"
                    onClick={closeConversation}
                    disabled={
                      loading || selectedConversation.status === "closed"
                    }
                  >
                    إنهاء
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={deleteConversation}
                    disabled={loading}
                  >
                    حذف
                  </button>
                </div>
              </div>

              <div className="messages-panel">
                {messages.length === 0 ? (
                  <div className="empty center">
                    لا توجد رسائل داخل هذه المحادثة.
                  </div>
                ) : (
                  messages.map((message) => {
                    const day = formatDay(message.created_at);
                    const showDay = day && day !== lastDay;
                    if (showDay) lastDay = day;

                    return (
                      <div key={message.id}>
                        {showDay ? (
                          <div className="day-separator">{day}</div>
                        ) : null}
                        <div className={`message-row ${messageClass(message)}`}>
                          <article className="bubble">
                            <header>
                              <span>{senderIcon(message)}</span>
                              <b>{senderLabel(message)}</b>
                            </header>
                            {message.message ? <p>{message.message}</p> : null}
                            {message.image_url ? (
                              <a
                                href={message.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="image-link"
                              >
                                فتح الصورة المرفقة 📷
                              </a>
                            ) : null}
                            {message.ai_detected_problem ? (
                              <small>
                                التشخيص: {message.ai_detected_problem}
                              </small>
                            ) : null}
                            <time>{formatDateTime(message.created_at)}</time>
                          </article>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <footer className="composer">
                <div className="quick-row">
                  {QUICK_REPLIES.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setReply(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="composer-row">
                  <button
                    type="button"
                    className="emoji-btn"
                    onClick={() => setEmojiOpen((value) => !value)}
                  >
                    🙂
                  </button>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder="اكتب الرد هنا… Enter للإرسال"
                    disabled={
                      loading || selectedConversation.status === "closed"
                    }
                  />
                  <button
                    type="button"
                    className="send-btn"
                    onClick={sendReply}
                    disabled={
                      loading ||
                      !reply.trim() ||
                      selectedConversation.status === "closed"
                    }
                  >
                    إرسال
                  </button>
                </div>

                {emojiOpen ? (
                  <div className="emoji-tray">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => appendToReply(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </footer>
            </>
          ) : (
            <div className="empty center">اختر محادثة من القائمة.</div>
          )}
        </section>

        <aside className="details-panel">
          {selectedConversation ? (
            <>
              <section className="profile-card hero">
                <span>ملف العميل</span>
                <h3>{getCustomerName(selectedConversation)}</h3>
                <p>
                  {statusLabel(selectedConversation)} ·{" "}
                  {selectedConversation.language || "ar"}
                </p>
              </section>

              <section className="profile-card">
                <h4>بيانات التواصل</h4>
                <dl>
                  <div>
                    <dt>الجوال</dt>
                    <dd>
                      {selectedConversation.customer_phone || "غير متوفر"}
                    </dd>
                  </div>
                  <div>
                    <dt>الإيميل</dt>
                    <dd>
                      {selectedConversation.customer_email || "غير متوفر"}
                    </dd>
                  </div>
                  <div>
                    <dt>آخر نشاط</dt>
                    <dd>
                      {formatDateTime(selectedConversation.last_message_at) ||
                        "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>البداية</dt>
                    <dd>
                      {formatDateTime(selectedConversation.created_at) || "—"}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="copy"
                  onClick={copyConversationInfo}
                >
                  نسخ البيانات
                </button>
              </section>

              <section className="profile-card team">
                <h4>إسناد الفريق لاحقًا</h4>
                <p>
                  جاهزة لاحقًا لتوزيع المحادثات على أكثر من مختص ومتابعة الأداء.
                </p>
                <div>
                  <span>المسند إليه</span>
                  <b>{selectedConversation.assigned_to || "غير مسند"}</b>
                </div>
              </section>

              <section className="profile-card">
                <h4>رابط الصفحة</h4>
                <p className="breakable">
                  {selectedConversation.page_url || "غير متوفر"}
                </p>
              </section>
            </>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700;800&display=swap');

  :root {
    color-scheme: light;
    --j-bg: #f5f1e8;
    --j-surface: rgba(255,255,255,.82);
    --j-surface-solid: #ffffff;
    --j-ink: #102b31;
    --j-muted: #607176;
    --j-soft: #eef6f3;
    --j-line: rgba(16,43,49,.105);
    --j-green: #005f5d;
    --j-green2: #00867f;
    --j-emerald: #11a36f;
    --j-gold: #c99a3a;
    --j-gold2: #f4d99a;
    --j-red: #c4333a;
    --j-blue: #2a75aa;
    --j-violet: #6b5bd6;
    --j-shadow: 0 16px 46px rgba(26, 45, 51, .105);
    --j-shadow-soft: 0 8px 22px rgba(26, 45, 51, .075);
  }

  html, body {
    margin: 0 !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    background: var(--j-bg) !important;
  }

  * { box-sizing: border-box; }
  button, input, textarea { font-family: inherit; }
  button { -webkit-tap-highlight-color: transparent; }

  .jth-desk {
    position: relative;
    width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
    direction: rtl;
    color: var(--j-ink);
    font-family: 'IBM Plex Sans Arabic', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: grid;
    grid-template-rows: 46px minmax(0, 1fr);
    gap: 7px;
    padding: 7px;
    background:
      radial-gradient(circle at 7% 7%, rgba(201,154,58,.23), transparent 22%),
      radial-gradient(circle at 88% 10%, rgba(0,134,127,.20), transparent 28%),
      radial-gradient(circle at 42% 94%, rgba(107,91,214,.09), transparent 22%),
      linear-gradient(135deg, #fbf7ec 0%, #f5fbf8 48%, #fff7e7 100%);
  }

  .jth-desk::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    opacity: .45;
    background-image:
      linear-gradient(rgba(16,43,49,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(16,43,49,.03) 1px, transparent 1px);
    background-size: 42px 42px;
    mask-image: radial-gradient(circle at center, #000, transparent 78%);
  }

  .desk-top,
  .desk-grid { position: relative; z-index: 1; }

  .desk-top {
    min-height: 0;
    display: grid;
    grid-template-columns: 235px minmax(260px, 1fr) auto;
    align-items: stretch;
    gap: 7px;
  }

  .brand-mini,
  .metric-strip,
  .top-actions,
  .inbox-panel,
  .chat-panel,
  .details-panel {
    border: 1px solid rgba(255,255,255,.76);
    background: var(--j-surface);
    box-shadow: var(--j-shadow-soft);
    backdrop-filter: blur(18px) saturate(1.08);
  }

  .brand-mini {
    border-radius: 17px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 8px;
    overflow: hidden;
  }

  .brand-mini::after {
    content: "MAJESTIC DESK";
    margin-inline-start: auto;
    color: rgba(201,154,58,.85);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .11em;
    white-space: nowrap;
  }

  .brand-logo,
  .avatar {
    display: grid;
    place-items: center;
    color: #fff;
    background:
      linear-gradient(145deg, rgba(255,255,255,.18), transparent 28%),
      linear-gradient(145deg, var(--j-green), #064348);
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,.18),
      0 8px 18px rgba(0,95,93,.18);
  }

  .brand-logo {
    width: 32px;
    height: 32px;
    border-radius: 13px;
    font-size: 18px;
    font-weight: 800;
  }

  .brand-mini b {
    display: block;
    font-size: 15px;
    line-height: 1;
    letter-spacing: -.03em;
  }

  .brand-mini small {
    display: block;
    margin-top: 2px;
    color: var(--j-muted);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .07em;
    text-transform: uppercase;
  }

  .metric-strip {
    border-radius: 17px;
    display: grid;
    grid-template-columns: repeat(4, minmax(72px, 1fr));
    overflow: hidden;
  }

  .metric-strip span {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--j-muted);
    font-size: 11px;
    font-weight: 700;
    background: rgba(255,255,255,.28);
  }

  .metric-strip span + span { border-inline-start: 1px solid rgba(16,43,49,.055); }
  .metric-strip b {
    color: var(--j-ink);
    font-size: 17px;
    font-weight: 800;
  }
  .metric-strip .warn b { color: var(--j-red); }
  .metric-strip .hot b { color: var(--j-green); }

  .top-actions {
    border-radius: 17px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px;
  }

  .top-btn {
    height: 34px;
    border: 1px solid var(--j-line);
    border-radius: 13px;
    background: rgba(255,255,255,.78);
    color: var(--j-ink);
    padding: 0 10px;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
  }
  .top-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 16px rgba(26,45,51,.08); }
  .top-btn.on,
  .top-btn.sound.on {
    color: #fff;
    border-color: transparent;
    background: linear-gradient(135deg, var(--j-green), var(--j-green2));
  }

  .desk-grid {
    min-height: 0;
    height: 100%;
    display: grid;
    grid-template-columns: 315px minmax(0, 1fr) 0;
    gap: 7px;
    overflow: hidden;
  }
  .desk-grid.show-details { grid-template-columns: 315px minmax(0, 1fr) 275px; }

  .inbox-panel,
  .chat-panel,
  .details-panel {
    min-height: 0;
    border-radius: 22px;
    overflow: hidden;
  }

  .inbox-panel {
    display: grid;
    grid-template-rows: 36px 38px 36px minmax(0, 1fr);
    padding: 7px;
    gap: 6px;
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 3px;
  }
  .panel-head strong { font-size: 13px; font-weight: 800; letter-spacing: -.01em; }
  .panel-head strong::after {
    content: "  ·  مركز العناية";
    color: var(--j-muted);
    font-size: 10px;
    font-weight: 700;
  }
  .panel-head em {
    min-width: 23px;
    height: 23px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: #fff;
    background: linear-gradient(135deg, var(--j-red), #ef5960);
    font-size: 11px;
    font-style: normal;
    font-weight: 800;
  }

  .search-line {
    height: 38px;
    border: 1px solid var(--j-line);
    border-radius: 15px;
    background: rgba(255,255,255,.70);
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 10px;
  }
  .search-line span { color: var(--j-gold); font-weight: 800; font-size: 15px; }
  .search-line input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--j-ink);
    font-size: 12px;
    font-weight: 600;
  }

  .filters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
  .filters button {
    border: 1px solid var(--j-line);
    border-radius: 13px;
    background: rgba(255,255,255,.62);
    color: var(--j-muted);
    font-size: 10.5px;
    font-weight: 800;
    cursor: pointer;
    transition: .15s ease;
  }
  .filters button:hover { background: #fff; }
  .filters button.active {
    color: #fff;
    border-color: transparent;
    background: linear-gradient(135deg, var(--j-green), var(--j-green2));
  }

  .conversation-list { min-height: 0; overflow: auto; padding-inline-end: 2px; }
  .conversation-card {
    position: relative;
    width: 100%;
    display: grid;
    grid-template-columns: 31px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: start;
    border: 1px solid rgba(16,43,49,.075);
    border-radius: 17px;
    background: rgba(255,255,255,.68);
    padding: 8px;
    margin-bottom: 6px;
    color: var(--j-ink);
    cursor: pointer;
    text-align: right;
    transition: .16s ease;
  }
  .conversation-card:hover { transform: translateY(-1px); background: rgba(255,255,255,.92); box-shadow: 0 10px 18px rgba(26,45,51,.075); }
  .conversation-card.active {
    background: #fff;
    border-color: rgba(201,154,58,.48);
    box-shadow: 0 12px 24px rgba(26,45,51,.095);
  }
  .conversation-card.active::before {
    content: "";
    position: absolute;
    inset-inline-end: 0;
    top: 12px;
    bottom: 12px;
    width: 3px;
    border-radius: 999px;
    background: linear-gradient(180deg, var(--j-gold), var(--j-green2));
  }

  .status-dot {
    position: absolute;
    top: 9px;
    inset-inline-start: 9px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #a8b3b6;
  }
  .status-dot.danger { background: var(--j-red); box-shadow: 0 0 0 4px rgba(196,51,58,.10); }
  .status-dot.success { background: var(--j-emerald); box-shadow: 0 0 0 4px rgba(17,163,111,.10); }
  .status-dot.ai { background: var(--j-blue); box-shadow: 0 0 0 4px rgba(42,117,170,.10); }

  .avatar {
    width: 31px;
    height: 31px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 800;
    flex: 0 0 auto;
  }
  .avatar.lg { width: 34px; height: 34px; border-radius: 13px; font-size: 15px; }
  .conversation-content { min-width: 0; display: grid; gap: 3px; }
  .conversation-title { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
  .conversation-title strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 800; }
  .conversation-title time { color: var(--j-muted); font-size: 9.5px; font-weight: 700; white-space: nowrap; }
  .conversation-preview { color: #435459; font-size: 11px; font-weight: 600; line-height: 1.32; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .conversation-meta { display: flex; align-items: center; gap: 5px; justify-content: space-between; }
  .conversation-meta small:last-child { color: var(--j-muted); font-size: 9px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .mini-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 19px;
    border-radius: 999px;
    padding: 0 7px;
    font-size: 9px;
    font-weight: 800;
    white-space: nowrap;
  }
  .mini-pill.large { height: 23px; font-size: 10px; }
  .mini-pill.danger { color: #941b21; background: #fff1f1; border: 1px solid rgba(196,51,58,.18); }
  .mini-pill.success { color: #08744e; background: #e9fbf2; border: 1px solid rgba(17,163,111,.18); }
  .mini-pill.ai { color: #075985; background: #edf8ff; border: 1px solid rgba(42,117,170,.16); }
  .mini-pill.muted { color: #66737a; background: #f3f5f5; border: 1px solid rgba(148,163,184,.18); }
  .unread {
    min-width: 21px;
    height: 21px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(135deg, var(--j-red), #ef5960);
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
  }

  .chat-panel {
    display: grid;
    grid-template-rows: 48px minmax(0, 1fr) 80px;
    background: rgba(255,255,255,.84);
  }
  .chat-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 50% 0%, rgba(201,154,58,.08), transparent 30%),
      radial-gradient(circle at 100% 100%, rgba(0,134,127,.07), transparent 34%);
  }

  .chat-head {
    position: relative;
    z-index: 1;
    min-height: 0;
    border-bottom: 1px solid var(--j-line);
    padding: 7px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: rgba(255,255,255,.66);
  }
  .chat-user { min-width: 0; display: flex; align-items: center; gap: 8px; }
  .chat-user h2 {
    margin: 0;
    max-width: 34vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15.5px;
    font-weight: 800;
    line-height: 1.1;
  }
  .chat-user p { margin: 2px 0 0; color: var(--j-muted); font-size: 10px; font-weight: 600; white-space: nowrap; }
  .chat-actions { display: flex; align-items: center; gap: 5px; flex: 0 0 auto; }
  .chat-actions button {
    height: 32px;
    border: 0;
    border-radius: 12px;
    padding: 0 10px;
    font-size: 10.5px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .chat-actions button:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(26,45,51,.08); }
  .chat-actions .ghost { color: var(--j-ink); background: #fff; border: 1px solid var(--j-line); }
  .chat-actions .finish { color: #fff; background: linear-gradient(135deg, var(--j-green), var(--j-green2)); }
  .chat-actions .danger { color: #fff; background: linear-gradient(135deg, #a51f27, #ef4444); }
  .chat-actions button:disabled { opacity: .45; cursor: not-allowed; transform: none; }

  .messages-panel {
    position: relative;
    z-index: 1;
    min-height: 0;
    overflow: auto;
    padding: 11px;
    background:
      linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,.18)),
      radial-gradient(circle at 50% 12%, rgba(201,154,58,.035), transparent 27%);
  }
  .messages-panel::before {
    content: "جذرة";
    position: sticky;
    top: 40%;
    display: block;
    width: max-content;
    margin: 0 auto -38px;
    color: rgba(16,43,49,.025);
    font-size: 62px;
    font-weight: 800;
    pointer-events: none;
    transform: rotate(-8deg);
  }

  .day-separator {
    width: max-content;
    max-width: 92%;
    margin: 2px auto 9px;
    color: #715b20;
    background: linear-gradient(135deg, #fff8e7, #fff2cb);
    border: 1px solid rgba(201,154,58,.22);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 9.5px;
    font-weight: 800;
  }
  .message-row { display: flex; margin-bottom: 8px; }
  .message-row.customer { justify-content: flex-start; }
  .message-row.ai, .message-row.human, .message-row.system { justify-content: flex-end; }
  .bubble {
    max-width: min(650px, 70%);
    padding: 9px 11px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,.72);
    box-shadow: 0 10px 22px rgba(26,45,51,.07);
  }
  .message-row.customer .bubble { color: #fff; background: linear-gradient(145deg, var(--j-green), #06464b); border-bottom-right-radius: 7px; }
  .message-row.human .bubble { color: #fff; background: linear-gradient(145deg, #277e8a, #1b6075); border-bottom-left-radius: 7px; }
  .message-row.ai .bubble { color: var(--j-ink); background: #fff; border-color: rgba(0,95,93,.09); border-bottom-left-radius: 7px; }
  .message-row.system .bubble { color: #745718; background: #fff8e7; }
  .bubble header { display: flex; align-items: center; gap: 5px; opacity: .72; margin-bottom: 4px; font-size: 10px; font-weight: 800; }
  .bubble p { margin: 0; white-space: pre-wrap; line-height: 1.56; font-size: 13px; font-weight: 600; }
  .bubble small, .bubble time { display: block; margin-top: 5px; color: currentColor; opacity: .62; font-size: 9.5px; font-weight: 700; }
  .image-link { display: inline-block; margin-top: 6px; color: var(--j-green); font-size: 11px; font-weight: 800; }
  .message-row.customer .image-link, .message-row.human .image-link { color: #fff4bd; }

  .composer {
    position: relative;
    z-index: 2;
    min-height: 0;
    border-top: 1px solid var(--j-line);
    padding: 6px 7px;
    background: rgba(255,255,255,.89);
    display: grid;
    grid-template-rows: 25px 38px;
    gap: 5px;
  }
  .quick-row { display: flex; gap: 5px; overflow: auto; min-width: 0; padding-bottom: 1px; }
  .quick-row button {
    flex: 0 0 auto;
    max-width: 330px;
    border: 1px solid rgba(0,95,93,.10);
    background: #fff;
    color: var(--j-ink);
    border-radius: 999px;
    padding: 0 10px;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .composer-row { display: grid; grid-template-columns: 38px minmax(0, 1fr) 68px; gap: 6px; }
  .composer-row textarea {
    width: 100%; height: 38px; min-height: 38px; max-height: 74px;
    resize: none; overflow: auto;
    border: 1px solid rgba(0,95,93,.14);
    border-radius: 15px;
    background: #fff;
    color: var(--j-ink);
    outline: 0;
    padding: 8px 11px;
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.42;
  }
  .composer-row textarea:focus { border-color: rgba(201,154,58,.60); box-shadow: 0 0 0 4px rgba(201,154,58,.10); }
  .emoji-btn, .send-btn { height: 38px; border: 0; border-radius: 15px; font-size: 12.5px; font-weight: 800; cursor: pointer; }
  .emoji-btn { background: #fff; border: 1px solid rgba(0,95,93,.12); }
  .send-btn { color: #fff; background: linear-gradient(135deg, var(--j-green), var(--j-green2)); }
  .send-btn:disabled { opacity: .48; cursor: not-allowed; }
  .emoji-tray {
    position: absolute; bottom: 56px; inset-inline-start: 18px;
    display: flex; gap: 6px; padding: 7px; border-radius: 16px;
    background: #fff; border: 1px solid var(--j-line); box-shadow: var(--j-shadow);
  }
  .emoji-tray button { border: 1px solid rgba(0,95,93,.10); background: #fff; border-radius: 12px; width: 31px; height: 31px; cursor: pointer; }

  .details-panel { display: none; padding: 7px; overflow: auto; gap: 7px; flex-direction: column; }
  .show-details .details-panel { display: flex; }
  .profile-card { background: rgba(255,255,255,.72); border: 1px solid rgba(16,43,49,.08); border-radius: 18px; padding: 10px; }
  .profile-card.hero { color: #fff; background: linear-gradient(145deg, var(--j-green), #06464b); border: 0; }
  .profile-card span { color: #fff1b9; font-size: 10px; font-weight: 800; }
  .profile-card h3, .profile-card h4 { margin: 0 0 6px; font-size: 13px; font-weight: 800; }
  .profile-card p { margin: 0; color: var(--j-muted); font-size: 11px; line-height: 1.55; font-weight: 600; }
  .profile-card.hero p { color: rgba(255,255,255,.78); }
  .profile-card dl { margin: 0; display: grid; gap: 6px; }
  .profile-card dl div { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px dashed rgba(0,95,93,.11); padding-bottom: 5px; }
  .profile-card dt { color: var(--j-muted); font-size: 10px; font-weight: 700; }
  .profile-card dd { margin: 0; color: var(--j-ink); text-align: left; word-break: break-word; font-size: 10.5px; font-weight: 700; }
  .profile-card .copy, .copy { width: 100%; height: 32px; margin-top: 8px; border: 1px solid rgba(201,154,58,.28); background: #fff6df; color: #75591a; border-radius: 13px; font-size: 11px; font-weight: 800; cursor: pointer; }
  .profile-card.team { background: linear-gradient(135deg, #fff, #f1fbf6); }
  .profile-card.team div { margin-top: 8px; display: flex; justify-content: space-between; gap: 8px; background: var(--j-soft); color: var(--j-green); border-radius: 13px; padding: 8px; font-size: 11px; font-weight: 800; }
  .breakable { word-break: break-word; }

  .empty { color: var(--j-muted); padding: 14px; font-size: 12px; font-weight: 700; }
  .empty.small { text-align: center; }
  .empty.center { margin: auto; text-align: center; }
  .jth-toast { position: fixed; z-index: 9999; left: 12px; bottom: 12px; background: rgba(0,95,93,.98); color: #fff; border-radius: 16px; padding: 10px 13px; box-shadow: 0 16px 34px rgba(0,95,93,.18); font-size: 12px; font-weight: 800; }
  ::-webkit-scrollbar { width: 7px; height: 7px; }
  ::-webkit-scrollbar-track { background: rgba(0,95,93,.045); border-radius: 999px; }
  ::-webkit-scrollbar-thumb { background: rgba(0,95,93,.34); border-radius: 999px; border: 2px solid rgba(255,255,255,.62); }

  @media (max-width: 1380px) {
    .desk-grid, .desk-grid.show-details { grid-template-columns: 300px minmax(0, 1fr); }
    .details-panel { display: none !important; }
    .chat-user h2 { max-width: 28vw; }
    .brand-mini::after { display: none; }
  }
  @media (max-width: 980px) {
    html, body { overflow: auto !important; }
    .jth-desk { height: auto; min-height: 100dvh; overflow: visible; grid-template-rows: auto auto; padding: 7px; }
    .desk-top { grid-template-columns: 1fr; height: auto; }
    .brand-mini, .metric-strip, .top-actions { height: 44px; }
    .metric-strip { overflow-x: auto; }
    .desk-grid, .desk-grid.show-details { grid-template-columns: 1fr; overflow: visible; height: auto; }
    .inbox-panel { height: 31dvh; min-height: 225px; }
    .chat-panel { height: 66dvh; min-height: 440px; }
    .bubble { max-width: 88%; }
    .emoji-tray { inset-inline-start: 12px; bottom: 70px; }
  }
  @media (max-width: 640px) {
    .jth-desk { padding: 5px; gap: 5px; }
    .brand-mini { border-radius: 15px; }
    .metric-strip span { font-size: 9.5px; }
    .metric-strip b { font-size: 14px; }
    .top-actions { display: grid; grid-template-columns: 1fr 1fr; }
    .top-btn { width: 100%; padding-inline: 7px; }
    .inbox-panel { height: 28dvh; min-height: 205px; border-radius: 18px; }
    .chat-panel { height: 68dvh; min-height: 450px; border-radius: 18px; grid-template-rows: auto minmax(0,1fr) 82px; }
    .chat-head { align-items: stretch; flex-direction: column; }
    .chat-user h2 { max-width: 70vw; }
    .chat-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; }
    .chat-actions button { width: 100%; }
    .messages-panel { padding: 8px; }
    .messages-panel::before { font-size: 44px; }
    .bubble { max-width: 94%; padding: 8px 10px; }
    .bubble p { font-size: 12.5px; }
    .quick-row button { max-width: 230px; }
    .composer-row { grid-template-columns: 38px minmax(0,1fr) 64px; gap: 5px; }
    .composer-row textarea { font-size: 12px; padding: 8px; }
    .emoji-btn, .send-btn { height: 38px; border-radius: 14px; }
    .jth-toast { left: 7px; right: 7px; bottom: 7px; text-align: center; }
  }
`;

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Jothrah Admin Conversations V97 - customer name fix + manual naming

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

function isGeneratedVisitorId(value?: unknown) {
  const text = String(value || "").trim();
  return (
    /^jth_[a-z0-9_\-]+$/i.test(text) ||
    /^visitor_[a-z0-9_\-]+$/i.test(text) ||
    /^guest_[a-z0-9_\-]+$/i.test(text)
  );
}

function cleanDisplayName(value?: unknown) {
  const text = String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length < 2) return "";
  if (isGeneratedVisitorId(text)) return "";
  return text.slice(0, 80);
}

function getCustomerName(conversation?: Conversation | null) {
  const name = cleanDisplayName(conversation?.customer_name);
  if (name) return name;

  const phone = cleanDisplayName(conversation?.customer_phone);
  if (phone) return phone;

  const email = cleanDisplayName(conversation?.customer_email);
  if (email) return email;

  return "زائر بدون اسم";
}

function getCustomerInitial(conversation?: Conversation | null) {
  const name = getCustomerName(conversation);
  if (name === "زائر بدون اسم") return "ز";
  return String(name).slice(0, 1);
}

function getCustomerSessionCode(conversation?: Conversation | null) {
  const code = String(conversation?.visitor_id || conversation?.id || "").trim();
  if (!code) return "—";
  return code.length > 16 ? `${code.slice(0, 8)}…${code.slice(-6)}` : code;
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
    ctx.resume?.();

    const master = ctx.createGain();
    const bell = ctx.createOscillator();
    const shine = ctx.createOscillator();
    const low = ctx.createOscillator();

    bell.type = "sine";
    shine.type = "triangle";
    low.type = "sine";

    const t = ctx.currentTime;
    bell.frequency.setValueAtTime(740, t);
    bell.frequency.exponentialRampToValueAtTime(980, t + 0.08);
    shine.frequency.setValueAtTime(1180, t + 0.08);
    low.frequency.setValueAtTime(392, t);

    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.24, t + 0.025);
    master.gain.exponentialRampToValueAtTime(0.16, t + 0.16);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 0.58);

    bell.connect(master);
    shine.connect(master);
    low.connect(master);
    master.connect(ctx.destination);

    bell.start(t);
    bell.stop(t + 0.32);
    shine.start(t + 0.09);
    shine.stop(t + 0.52);
    low.start(t);
    low.stop(t + 0.22);

    setTimeout(() => ctx.close?.(), 900);
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "waiting" | "open" | "closed">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [typingConversationId, setTypingConversationId] = useState<string | null>(null);
  const [typingUntil, setTypingUntil] = useState(0);
  const [nameDraft, setNameDraft] = useState(
    cleanDisplayName(initialData.selectedConversation?.customer_name),
  );
  const [savingName, setSavingName] = useState(false);
  const [, setClockTick] = useState(0);

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

  useEffect(() => {
    setNameDraft(cleanDisplayName(selectedConversation?.customer_name));
  }, [selectedConversation?.id, selectedConversation?.customer_name]);

  useEffect(() => {
    const timer = setInterval(() => setClockTick(Date.now()), 700);
    return () => clearInterval(timer);
  }, []);

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

        if (selectedHasNewCustomer && id) {
          setTypingConversationId(id);
          setTypingUntil(Date.now() + 3500);
        }

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
      if (newestCustomer?.id) {
        lastSeenCustomerMessageId.current = newestCustomer.id;
        const lastCustomerAt = newestCustomer.created_at
          ? new Date(newestCustomer.created_at).getTime()
          : 0;
        if (Date.now() - lastCustomerAt < 9000) {
          setTypingConversationId(id);
          setTypingUntil(Date.now() + 2200);
        }
      }
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
    if (!selectedId || !message || loading || reply.length > 1200) return;

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

  async function saveCustomerName() {
    if (!selectedId || savingName || loading) return;

    const cleanName = cleanDisplayName(nameDraft);
    if (!cleanName) {
      flashToast("اكتب اسم العميل بشكل واضح، مثال: محمد عبدالله");
      return;
    }

    setSavingName(true);
    try {
      const res = await fetch(`/api/admin/conversations/${selectedId}/name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: cleanName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "تعذر تحديث اسم العميل");

      const updated = data.conversation || null;
      if (updated?.id) {
        setSelectedConversation(updated);
        setConversations((current) =>
          current.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item,
          ),
        );
      } else {
        setSelectedConversation((current) =>
          current ? { ...current, customer_name: cleanName } : current,
        );
        setConversations((current) =>
          current.map((item) =>
            item.id === selectedId ? { ...item, customer_name: cleanName } : item,
          ),
        );
      }

      flashToast("تم حفظ اسم العميل ✅");
    } catch (error) {
      flashToast(error instanceof Error ? error.message : "تعذر تحديث اسم العميل");
    } finally {
      setSavingName(false);
    }
  }

  function appendToReply(value: string) {
    setReply((current) => `${current}${value}`);
  }

  function copyConversationInfo() {
    if (!selectedConversation) return;

    const text = [
      `العميل: ${getCustomerName(selectedConversation)}`,
      `رمز الجلسة: ${selectedConversation.visitor_id || "غير متوفر"}`,
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

  const replyLimit = 1200;
  const replyLength = reply.length;
  const replyCounterTone =
    replyLength > replyLimit
      ? "danger"
      : replyLength > Math.floor(replyLimit * 0.82)
        ? "warn"
        : "";
  const customerTyping =
    Boolean(selectedId) &&
    typingConversationId === selectedId &&
    Date.now() < typingUntil &&
    selectedConversation?.status !== "closed";

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
          </div>
        </div>

        <div className="metric-strip" aria-label="إحصائيات المحادثات">
          <span>
            <b key={`total-${stats.total}`}>{stats.total}</b> الكل
          </span>
          <span className={stats.waiting ? "warn" : ""}>
            <b key={`waiting-${stats.waiting}`}>{stats.waiting}</b> ينتظر
          </span>
          <span className={stats.unread ? "hot" : ""}>
            <b key={`unread-${stats.unread}`}>{stats.unread}</b> جديد
          </span>
          <span>
            <b key={`closed-${stats.closed}`}>{stats.closed}</b> مغلق
          </span>
        </div>

        <div className="top-actions">
          <button
            type="button"
            className={soundEnabled ? "top-btn sound on" : "top-btn sound"}
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) {
                playLuxuryNotify();
                flashToast("الصوت مفعّل 🔔");
              } else {
                flashToast("تم كتم الصوت 🔕");
              }
            }}
          >
            {soundEnabled ? "🔔 كتم الصوت" : "🔕 تشغيل الصوت"}
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
                    className={[
                      "conversation-card",
                      active ? "active" : "",
                      tone === "danger" ? "waiting" : "",
                      conversation.id === typingConversationId && Date.now() < typingUntil
                        ? "typing"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <span className={`status-dot ${tone}`} />
                    <span className="avatar">
                      {getCustomerInitial(conversation)}
                    </span>
                    <span className="conversation-content">
                      <span className="conversation-title">
                        <strong>{getCustomerName(conversation)}</strong>
                        <time>
                          {formatTime(conversation.last_message_at) || "—"}
                        </time>
                      </span>
                      <span className="conversation-preview">
                        {conversation.id === typingConversationId && Date.now() < typingUntil
                          ? "العميل يكتب الآن…"
                          : conversation.last_message || "بدون رسالة"}
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
                    {getCustomerInitial(selectedConversation)}
                  </span>
                  <div>
                    <h2>{getCustomerName(selectedConversation)}</h2>
                    <p>
                      {selectedConversation.language || "ar"} · رمز الجلسة {getCustomerSessionCode(selectedConversation)} ·{" "}
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
                {customerTyping ? (
                  <div className="typing-indicator" aria-live="polite">
                    <span />
                    <span />
                    <span />
                    <b>العميل يكتب الآن…</b>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>

              <footer className="composer">
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
                    maxLength={replyLimit + 80}
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
                      replyLength > replyLimit ||
                      selectedConversation.status === "closed"
                    }
                  >
                    إرسال
                  </button>
                </div>

                <div className="composer-meta">
                  <span className={`char-counter ${replyCounterTone}`}>
                    {replyLength}/{replyLimit}
                  </span>
                  <span>Enter للإرسال · Shift + Enter لسطر جديد</span>
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
                  {statusLabel(selectedConversation)} · رمز الجلسة {getCustomerSessionCode(selectedConversation)}
                </p>
                <div className="name-editor">
                  <input
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    placeholder="اكتب اسم العميل هنا"
                    maxLength={80}
                  />
                  <button
                    type="button"
                    onClick={saveCustomerName}
                    disabled={savingName || loading}
                  >
                    {savingName ? "جارٍ الحفظ…" : "حفظ الاسم"}
                  </button>
                </div>
              </section>

              <section className="profile-card">
                <h4>بيانات التواصل</h4>
                <dl>
                  <div>
                    <dt>رمز الجلسة</dt>
                    <dd>{selectedConversation.visitor_id || "غير متوفر"}</dd>
                  </div>
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
  /* Jothrah V97: hides generated visitor ids, adds manual customer naming, keeps adaptive canvas */
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700;800&display=swap');

  :root {
    color-scheme: light;
    font-size: 14.8px;
    --j-page: #ffffff;
    --j-bg: #ffffff;
    --j-surface: rgba(255, 255, 255, .92);
    --j-surface-solid: #ffffff;
    --j-ink: #0f2430;
    --j-muted: #64747c;
    --j-soft: #f2f7f6;
    --j-line: rgba(15, 36, 48, .11);
    --j-green: #005f5d;
    --j-green2: #00867f;
    --j-emerald: #10a778;
    --j-red: #c4333a;
    --j-blue: #2676a8;
    --j-shadow: 0 18px 52px rgba(15, 36, 48, .11);
    --j-shadow-soft: 0 8px 24px rgba(15, 36, 48, .075);
  }

  html, body {
    margin: 0 !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    background: #ffffff !important;
    display: flex;
    justify-content: center;
  }

  * { box-sizing: border-box; }
  button, input, textarea { font-family: inherit; }
  button { -webkit-tap-highlight-color: transparent; }

  .jth-desk {
    position: relative;
    width: min(98vw, 1360px);
    max-width: 1360px;
    margin: 0 auto;
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
    direction: rtl;
    color: var(--j-ink);
    font-family: 'IBM Plex Sans Arabic', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: grid;
    grid-template-rows: 48px minmax(0, 1fr);
    gap: 8px;
    padding: 8px;
    background: #ffffff;
  }

  .jth-desk::before {
    content: "";
    position: absolute;
    inset: 8px;
    pointer-events: none;
    border-radius: 28px;
    background:
      radial-gradient(circle at 12% 10%, rgba(0, 134, 127, .10), transparent 28%),
      radial-gradient(circle at 88% 14%, rgba(38, 118, 168, .08), transparent 30%),
      linear-gradient(180deg, rgba(242, 247, 246, .90), rgba(255,255,255,.96));
    border: 1px solid rgba(15,36,48,.06);
  }

  .desk-top,
  .desk-grid { position: relative; z-index: 1; }

  .desk-top {
    min-height: 0;
    display: grid;
    grid-template-columns: 440px minmax(0, 1fr) auto;
    align-items: stretch;
    gap: 8px;
  }

  .brand-mini,
  .metric-strip,
  .top-actions,
  .inbox-panel,
  .chat-panel,
  .details-panel {
    border: 1px solid rgba(15,36,48,.08);
    background: rgba(255,255,255,.84);
    box-shadow: var(--j-shadow-soft);
    backdrop-filter: blur(18px) saturate(1.08);
  }

  .brand-mini {
    border-radius: 18px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    overflow: hidden;
  }

  .brand-logo,
  .avatar {
    display: grid;
    place-items: center;
    color: #fff;
    background:
      linear-gradient(145deg, rgba(255,255,255,.16), transparent 30%),
      linear-gradient(145deg, var(--j-green), #073e46);
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,.18),
      0 8px 18px rgba(0,95,93,.18);
  }

  .brand-logo {
    width: 36px;
    height: 36px;
    border-radius: 14px;
    font-size: 15.4px;
    font-weight: 800;
  }

  .brand-mini b {
    display: block;
    font-size: 15.7px;
    line-height: 1;
    letter-spacing: -.03em;
  }

  .metric-strip {
    border-radius: 18px;
    display: grid;
    grid-template-columns: repeat(4, minmax(76px, 1fr));
    overflow: hidden;
  }

  .metric-strip span {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: var(--j-muted);
    font-size: 12.5px;
    font-weight: 800;
    background: rgba(255,255,255,.45);
  }

  .metric-strip span + span { border-inline-start: 1px solid rgba(15,36,48,.07); }
  .metric-strip b {
    color: var(--j-ink);
    font-size: 15.4px;
    font-weight: 800;
    animation: statPop .26s ease both;
  }
  .metric-strip .warn b { color: var(--j-red); }
  .metric-strip .hot b { color: var(--j-green); }

  .top-actions {
    border-radius: 18px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px;
  }

  .top-btn {
    height: 36px;
    border: 1px solid var(--j-line);
    border-radius: 14px;
    background: rgba(255,255,255,.86);
    color: var(--j-ink);
    padding: 0 12px;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
  }
  .top-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 16px rgba(15,36,48,.08); }
  .top-btn.sound.on {
    color: #fff;
    border-color: transparent;
    background: linear-gradient(135deg, var(--j-green), var(--j-green2));
  }

  .desk-grid {
    min-height: 0;
    height: 100%;
    display: grid;
    grid-template-columns: 440px minmax(0, 1fr);
    gap: 8px;
    overflow: hidden;
  }
  .desk-grid.show-details { grid-template-columns: 440px minmax(0, 1fr); }

  .inbox-panel,
  .chat-panel,
  .details-panel {
    min-height: 0;
    border-radius: 22px;
    overflow: hidden;
  }

  .inbox-panel {
    display: grid;
    grid-template-rows: 42px 42px 38px minmax(0, 1fr);
    padding: 8px;
    gap: 7px;
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }
  .panel-head strong { font-size: 15.4px; font-weight: 800; letter-spacing: -.02em; }
  .panel-head strong::after { content: none; }
  .panel-head em {
    min-width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border-radius: 11px;
    color: #fff;
    background: linear-gradient(135deg, var(--j-red), #ef5960);
    font-size: 11.6px;
    font-style: normal;
    font-weight: 800;
    animation: waitingPulse 1.4s ease-in-out infinite;
  }

  .search-line {
    height: 42px;
    border: 1px solid var(--j-line);
    border-radius: 16px;
    background: rgba(255,255,255,.82);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
  }
  .search-line span { color: var(--j-green); font-weight: 800; font-size: 15.4px; }
  .search-line input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--j-ink);
    font-size: 14.8px;
    font-weight: 700;
  }

  .filters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .filters button {
    border: 1px solid var(--j-line);
    border-radius: 14px;
    background: rgba(255,255,255,.72);
    color: var(--j-muted);
    font-size: 13.5px;
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
    grid-template-columns: 38px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
    border: 1px solid rgba(15,36,48,.08);
    border-radius: 18px;
    background: rgba(255,255,255,.78);
    padding: 10px;
    margin-bottom: 7px;
    color: var(--j-ink);
    cursor: pointer;
    text-align: right;
    transition: transform .16s ease, box-shadow .16s ease, background .16s ease, border-color .16s ease;
    animation: messageIn .22s ease both;
  }
  .conversation-card:hover { transform: translateY(-1px); background: #fff; box-shadow: 0 10px 18px rgba(15,36,48,.075); }
  .conversation-card.active {
    background: #fff;
    border-color: rgba(0,95,93,.34);
    box-shadow: 0 14px 28px rgba(15,36,48,.105);
  }
  .conversation-card.active::before {
    content: "";
    position: absolute;
    inset-inline-end: 0;
    top: 12px;
    bottom: 12px;
    width: 4px;
    border-radius: 999px;
    background: linear-gradient(180deg, var(--j-green), var(--j-green2));
  }
  .conversation-card.waiting .mini-pill.danger,
  .mini-pill.large.danger { animation: waitingPulse 1.45s ease-in-out infinite; }
  .conversation-card.typing .conversation-preview { color: var(--j-green); font-weight: 800; }

  .status-dot {
    position: absolute;
    top: 10px;
    inset-inline-start: 10px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #a8b3b6;
  }
  .status-dot.danger { background: var(--j-red); box-shadow: 0 0 0 5px rgba(196,51,58,.10); animation: waitingDot 1.3s ease-in-out infinite; }
  .status-dot.success { background: var(--j-emerald); box-shadow: 0 0 0 5px rgba(16,167,120,.10); }
  .status-dot.ai { background: var(--j-blue); box-shadow: 0 0 0 5px rgba(38,118,168,.10); }

  .avatar {
    width: 38px;
    height: 38px;
    border-radius: 14px;
    font-size: 14.8px;
    font-weight: 800;
    flex: 0 0 auto;
  }
  .avatar.lg { width: 42px; height: 42px; border-radius: 15px; font-size: 16px; }
  .conversation-content { min-width: 0; display: grid; gap: 4px; }
  .conversation-title { display: flex; justify-content: space-between; gap: 9px; align-items: center; }
  .conversation-title strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15.4px; font-weight: 800; }
  .conversation-title time { color: var(--j-muted); font-size: 11.6px; font-weight: 800; white-space: nowrap; }
  .conversation-preview { color: #394d55; font-size: 13.9px; font-weight: 700; line-height: 1.42; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .conversation-meta { display: flex; align-items: center; gap: 6px; justify-content: space-between; }
  .conversation-meta small:last-child { color: var(--j-muted); font-size: 11.2px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .mini-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    border-radius: 999px;
    padding: 0 10px;
    font-size: 11.6px;
    font-weight: 800;
    white-space: nowrap;
  }
  .mini-pill.large { height: 28px; font-size: 12.5px; }
  .mini-pill.danger { color: #941b21; background: #fff1f1; border: 1px solid rgba(196,51,58,.18); }
  .mini-pill.success { color: #08744e; background: #e9fbf2; border: 1px solid rgba(16,167,120,.18); }
  .mini-pill.ai { color: #075985; background: #edf8ff; border: 1px solid rgba(38,118,168,.16); }
  .mini-pill.muted { color: #66737a; background: #f3f5f5; border: 1px solid rgba(148,163,184,.18); }
  .unread {
    min-width: 23px;
    height: 23px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(135deg, var(--j-red), #ef5960);
    border-radius: 999px;
    font-size: 10.8px;
    font-weight: 800;
  }

  .chat-panel {
    display: grid;
    grid-template-rows: 58px minmax(0, 1fr) 86px;
    background: rgba(255,255,255,.92);
  }
  .chat-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 50% 0%, rgba(0,134,127,.055), transparent 32%),
      linear-gradient(180deg, rgba(248,251,251,.75), rgba(255,255,255,.88));
  }

  .chat-head {
    position: relative;
    z-index: 1;
    min-height: 0;
    border-bottom: 1px solid var(--j-line);
    padding: 8px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: rgba(255,255,255,.80);
  }
  .chat-user { min-width: 0; display: flex; align-items: center; gap: 10px; }
  .chat-user h2 {
    margin: 0;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15.4px;
    font-weight: 800;
    line-height: 1.1;
  }
  .chat-user p { margin: 3px 0 0; color: var(--j-muted); font-size: 11.6px; font-weight: 700; white-space: nowrap; }
  .chat-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
  .chat-actions button {
    height: 36px;
    border: 0;
    border-radius: 14px;
    padding: 0 11px;
    font-size: 11.6px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .chat-actions button:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(15,36,48,.08); }
  .chat-actions .ghost { color: var(--j-ink); background: #fff; border: 1px solid var(--j-line); }
  .chat-actions .finish { color: #fff; background: linear-gradient(135deg, var(--j-green), var(--j-green2)); }
  .chat-actions .danger { color: #fff; background: linear-gradient(135deg, #a51f27, #ef4444); }
  .chat-actions button:disabled { opacity: .45; cursor: not-allowed; transform: none; }

  .messages-panel {
    position: relative;
    z-index: 1;
    min-height: 0;
    overflow: auto;
    padding: 12px 14px;
    background: rgba(255,255,255,.58);
  }
  .messages-panel::before {
    content: "جذرة";
    position: sticky;
    top: 40%;
    display: block;
    width: max-content;
    margin: 0 auto -38px;
    color: rgba(15,36,48,.024);
    font-size: 58px;
    font-weight: 800;
    pointer-events: none;
    transform: rotate(-8deg);
  }

  .day-separator {
    width: max-content;
    max-width: 92%;
    margin: 2px auto 10px;
    color: #31535a;
    background: #f3f7f7;
    border: 1px solid rgba(15,36,48,.08);
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 10.8px;
    font-weight: 800;
  }
  .message-row { display: flex; margin-bottom: 8px; animation: messageIn .24s ease both; }
  .message-row.customer { justify-content: flex-start; }
  .message-row.ai, .message-row.human, .message-row.system { justify-content: flex-end; }
  .bubble {
    max-width: min(520px, 74%);
    padding: 11px 14px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,.82);
    box-shadow: 0 10px 22px rgba(15,36,48,.07);
  }
  .message-row.customer .bubble { color: #fff; background: linear-gradient(145deg, var(--j-green), #06464b); border-bottom-right-radius: 7px; }
  .message-row.human .bubble { color: #fff; background: linear-gradient(145deg, #247d89, #1a6075); border-bottom-left-radius: 7px; }
  .message-row.ai .bubble { color: var(--j-ink); background: #fff; border-color: rgba(0,95,93,.09); border-bottom-left-radius: 7px; }
  .message-row.system .bubble { color: #33535a; background: #f3f7f7; }
  .bubble header { display: flex; align-items: center; gap: 6px; opacity: .75; margin-bottom: 6px; font-size: 12.5px; font-weight: 800; }
  .bubble p { margin: 0; white-space: pre-wrap; line-height: 1.68; font-size: 15.9px; font-weight: 650; }
  .bubble small, .bubble time { display: block; margin-top: 7px; color: currentColor; opacity: .62; font-size: 11.6px; font-weight: 700; }
  .image-link { display: inline-block; margin-top: 7px; color: var(--j-green); font-size: 12.5px; font-weight: 800; }
  .message-row.customer .image-link, .message-row.human .image-link { color: #dff9ef; }

  .typing-indicator {
    width: max-content;
    max-width: 76%;
    display: flex;
    align-items: center;
    gap: 5px;
    margin: 8px 0 10px auto;
    padding: 9px 12px;
    border-radius: 16px;
    color: var(--j-green);
    background: rgba(255,255,255,.90);
    border: 1px solid rgba(0,95,93,.11);
    box-shadow: 0 8px 20px rgba(15,36,48,.07);
    font-size: 12.5px;
    font-weight: 800;
  }
  .typing-indicator span {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--j-green);
    animation: typingDot .9s ease-in-out infinite;
  }
  .typing-indicator span:nth-child(2) { animation-delay: .12s; }
  .typing-indicator span:nth-child(3) { animation-delay: .24s; }

  .composer {
    position: relative;
    z-index: 2;
    min-height: 0;
    border-top: 1px solid var(--j-line);
    padding: 8px 10px 7px;
    background: rgba(255,255,255,.94);
    display: grid;
    grid-template-rows: 50px 18px;
    gap: 4px;
  }
  .composer-row { display: grid; grid-template-columns: 46px minmax(0, 1fr) 82px; gap: 8px; width: 100%; }
  .composer-row textarea {
    width: 100%; height: 50px; min-height: 50px; max-height: 78px;
    resize: none; overflow: auto;
    border: 1px solid rgba(0,95,93,.16);
    border-radius: 17px;
    background: #fff;
    color: var(--j-ink);
    outline: 0;
    padding: 12px 14px;
    font-size: 15.7px;
    font-weight: 650;
    line-height: 1.45;
  }
  .composer-row textarea:focus { border-color: rgba(0,95,93,.50); box-shadow: 0 0 0 4px rgba(0,95,93,.09); }
  .emoji-btn, .send-btn { height: 50px; border: 0; border-radius: 17px; font-size: 13.9px; font-weight: 800; cursor: pointer; }
  .emoji-btn { background: #fff; border: 1px solid rgba(0,95,93,.12); font-size: 19px; }
  .send-btn {
    position: relative;
    overflow: hidden;
    color: #fff;
    background: linear-gradient(135deg, var(--j-green), var(--j-green2));
  }
  .send-btn::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(120%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.42), transparent);
    transition: transform .55s ease;
  }
  .send-btn:not(:disabled):active::after,
  .send-btn:not(:disabled):hover::after { transform: translateX(-120%); }
  .send-btn:disabled { opacity: .48; cursor: not-allowed; }
  .composer-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--j-muted);
    font-size: 11.6px;
    font-weight: 800;
    padding: 0 4px;
  }
  .char-counter { color: var(--j-green); }
  .char-counter.warn { color: #a35a00; }
  .char-counter.danger { color: var(--j-red); }
  .emoji-tray {
    position: absolute; bottom: 78px; inset-inline-start: 18px;
    display: flex; gap: 6px; padding: 8px; border-radius: 16px;
    background: #fff; border: 1px solid var(--j-line); box-shadow: var(--j-shadow);
  }
  .emoji-tray button { border: 1px solid rgba(0,95,93,.10); background: #fff; border-radius: 12px; width: 34px; height: 34px; cursor: pointer; }

  .details-panel {
    display: none;
    position: absolute;
    left: 8px;
    top: 8px;
    bottom: 8px;
    width: 310px;
    z-index: 30;
    padding: 8px;
    overflow: auto;
    gap: 8px;
    flex-direction: column;
    border-radius: 22px;
    box-shadow: 0 22px 60px rgba(15,36,48,.18);
  }
  .show-details .details-panel { display: flex; }
  .profile-card { background: rgba(255,255,255,.88); border: 1px solid rgba(15,36,48,.08); border-radius: 18px; padding: 12px; }
  .profile-card.hero { color: #fff; background: linear-gradient(145deg, var(--j-green), #06464b); border: 0; }
  .profile-card span { color: #dff9ef; font-size: 10.8px; font-weight: 800; }
  .profile-card h3, .profile-card h4 { margin: 0 0 7px; font-size: 15px; font-weight: 800; }
  .profile-card p { margin: 0; color: var(--j-muted); font-size: 12.5px; line-height: 1.6; font-weight: 650; }
  .profile-card.hero p { color: rgba(255,255,255,.80); }
  .profile-card dl { margin: 0; display: grid; gap: 7px; }
  .profile-card dl div { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px dashed rgba(0,95,93,.11); padding-bottom: 6px; }
  .profile-card dt { color: var(--j-muted); font-size: 11.6px; font-weight: 750; }
  .profile-card dd { margin: 0; color: var(--j-ink); text-align: left; word-break: break-word; font-size: 11.6px; font-weight: 750; }
  .profile-card .copy, .copy { width: 100%; height: 36px; margin-top: 9px; border: 1px solid rgba(0,95,93,.18); background: #f1faf7; color: var(--j-green); border-radius: 14px; font-size: 12.5px; font-weight: 800; cursor: pointer; }
  .name-editor { margin-top: 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
  .name-editor input {
    width: 100%;
    border: 1px solid rgba(0,95,93,.18);
    background: rgba(255,255,255,.92);
    border-radius: 14px;
    padding: 10px 12px;
    color: var(--j-ink);
    font: inherit;
    font-weight: 800;
    outline: none;
  }
  .name-editor input:focus { border-color: rgba(0,95,93,.42); box-shadow: 0 0 0 4px rgba(0,95,93,.08); }
  .name-editor button {
    border: 0;
    border-radius: 14px;
    padding: 0 14px;
    background: var(--j-green);
    color: #fff;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
    white-space: nowrap;
  }
  .name-editor button:disabled { opacity: .55; cursor: not-allowed; }
  .profile-card.team { background: linear-gradient(135deg, #fff, #f1fbf6); }
  .profile-card.team div { margin-top: 9px; display: flex; justify-content: space-between; gap: 8px; background: var(--j-soft); color: var(--j-green); border-radius: 14px; padding: 9px; font-size: 11.6px; font-weight: 800; }
  .breakable { word-break: break-word; }

  .empty { color: var(--j-muted); padding: 14px; font-size: 13.5px; font-weight: 800; }
  .empty.small { text-align: center; }
  .empty.center { margin: auto; text-align: center; }
  .jth-toast { position: fixed; z-index: 9999; left: 14px; bottom: 14px; background: rgba(0,95,93,.98); color: #fff; border-radius: 16px; padding: 11px 14px; box-shadow: 0 16px 34px rgba(0,95,93,.18); font-size: 12.5px; font-weight: 800; }
  ::-webkit-scrollbar { width: 7px; height: 7px; }
  ::-webkit-scrollbar-track { background: rgba(0,95,93,.045); border-radius: 999px; }
  ::-webkit-scrollbar-thumb { background: rgba(0,95,93,.28); border-radius: 999px; border: 2px solid rgba(255,255,255,.72); }

  @keyframes messageIn {
    from { opacity: 0; transform: translateY(5px) scale(.992); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes statPop {
    0% { transform: translateY(4px) scale(.92); opacity: .55; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  @keyframes waitingPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(196,51,58,.18); }
    50% { box-shadow: 0 0 0 6px rgba(196,51,58,.04); }
  }
  @keyframes waitingDot {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.18); }
  }
  @keyframes typingDot {
    0%, 80%, 100% { opacity: .35; transform: translateY(0); }
    40% { opacity: 1; transform: translateY(-3px); }
  }

  @media (min-width: 1361px) {
    body::before,
    body::after {
      content: "";
      position: fixed;
      top: 0;
      bottom: 0;
      width: calc((100vw - 1360px) / 2);
      background: #ffffff;
      z-index: 0;
      pointer-events: none;
    }
    body::before { left: 0; }
    body::after { right: 0; }
  }

  @media (max-width: 1360px) {
    .jth-desk { width: min(98vw, 1360px); max-width: 1360px; }
    .desk-top { grid-template-columns: 420px minmax(0, 1fr) auto; }
    .desk-grid, .desk-grid.show-details { grid-template-columns: 420px minmax(0, 1fr); }
    .chat-user h2 { max-width: 260px; }
  }

  @media (max-width: 980px) {
    html, body { overflow: auto !important; display: block; }
    .jth-desk { height: auto; min-height: 100dvh; overflow: visible; grid-template-rows: auto auto; padding: 8px; }
    .desk-top { grid-template-columns: 1fr; height: auto; }
    .brand-mini, .metric-strip, .top-actions { min-height: 46px; }
    .metric-strip { overflow-x: auto; }
    .desk-grid, .desk-grid.show-details { grid-template-columns: 1fr; overflow: visible; height: auto; }
    .inbox-panel { height: 34dvh; min-height: 250px; }
    .chat-panel { height: 66dvh; min-height: 520px; grid-template-rows: auto minmax(0,1fr) 90px; }
    .bubble { max-width: 88%; }
    .details-panel { position: fixed; left: 8px; right: 8px; top: 8px; bottom: 8px; width: auto; }
    .emoji-tray { inset-inline-start: 12px; bottom: 82px; }
  }

  @media (max-width: 640px) {
    .jth-desk { padding: 6px; gap: 6px; }
    .jth-desk::before { inset: 6px; border-radius: 22px; }
    .brand-mini { border-radius: 16px; }
    .metric-strip span { font-size: 10.8px; }
    .metric-strip b { font-size: 16px; }
    .top-actions { display: grid; grid-template-columns: 1fr 1fr; }
    .top-btn { width: 100%; padding-inline: 8px; }
    .inbox-panel { height: 31dvh; min-height: 230px; border-radius: 18px; }
    .conversation-title strong { font-size: 15px; }
    .conversation-preview { font-size: 13.5px; }
    .chat-panel { height: 69dvh; min-height: 500px; border-radius: 18px; grid-template-rows: auto minmax(0,1fr) 92px; }
    .chat-head { align-items: stretch; flex-direction: column; }
    .chat-user h2 { max-width: 74vw; font-size: 15.4px; }
    .chat-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; }
    .chat-actions button { width: 100%; }
    .messages-panel { padding: 9px; }
    .messages-panel::before { font-size: 42px; }
    .bubble { max-width: 94%; padding: 9px 11px; }
    .bubble p { font-size: 14.8px; }
    .composer-row { grid-template-columns: 40px minmax(0,1fr) 68px; gap: 6px; }
    .composer-row textarea { font-size: 13.5px; padding: 9px; }
    .emoji-btn, .send-btn { height: 48px; border-radius: 15px; }
    .composer-meta { font-size: 10.5px; }
    .jth-toast { left: 8px; right: 8px; bottom: 8px; text-align: center; }
  }
`;

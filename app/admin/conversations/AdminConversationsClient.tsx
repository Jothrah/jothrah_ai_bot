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

const QUICK_EMOJIS = ["✅", "🌿", "📷", "🙏", "👍", "😊"];
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

function messageClass(message: ChatMessage) {
  if (message.sender_type === "customer") return "customer";
  if (message.sender_type === "human") return "human";
  if (message.sender_type === "ai") return "ai";
  return "system";
}

function playLuxuryNotify() {
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const gain = ctx.createGain();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();

    o1.type = "sine";
    o2.type = "triangle";
    o1.frequency.setValueAtTime(740, ctx.currentTime);
    o2.frequency.setValueAtTime(980, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);

    o1.connect(gain);
    o2.connect(gain);
    gain.connect(ctx.destination);

    o1.start(ctx.currentTime);
    o1.stop(ctx.currentTime + 0.16);
    o2.start(ctx.currentTime + 0.08);
    o2.stop(ctx.currentTime + 0.30);

    setTimeout(() => ctx.close?.(), 450);
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
  const [filter, setFilter] = useState<"all" | "waiting" | "closed">("all");
  const [toast, setToast] = useState("");

  const lastSeenCustomerMessageId = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const stats = useMemo(() => {
    const waiting = conversations.filter((item) => item.status === "needs_human" || item.needs_human).length;
    const unread = conversations.reduce((sum, item) => sum + (Number(item.unread_admin_count || 0) || 0), 0);
    const closed = conversations.filter((item) => item.status === "closed").length;
    return { waiting, unread, closed, total: conversations.length };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    if (filter === "waiting") {
      return conversations.filter((item) => item.status === "needs_human" || item.needs_human);
    }

    if (filter === "closed") {
      return conversations.filter((item) => item.status === "closed");
    }

    return conversations;
  }, [conversations, filter]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ block: "end" }), 40);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ block: "end" }), 180);
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

      const newestCustomer = [...nextMessages].reverse().find((msg) => msg.sender_type === "customer");

      if (
        newestCustomer?.id &&
        lastSeenCustomerMessageId.current &&
        newestCustomer.id !== lastSeenCustomerMessageId.current &&
        soundEnabled
      ) {
        playLuxuryNotify();
        flashToast("وصلت رسالة جديدة من عميل ✨");
      }

      if (newestCustomer?.id) {
        lastSeenCustomerMessageId.current = newestCustomer.id;
      }

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
    const name = selectedConversation?.customer_name || selectedConversation?.visitor_id || "هذه المحادثة";
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

  let lastDay = "";

  return (
    <main className="jth-admin-shell" dir="rtl">
      <style jsx global>{styles}</style>

      {toast ? <div className="jth-toast">{toast}</div> : null}

      <header className="jth-topbar">
        <div>
          <div className="jth-kicker">Jothrah Luxury Support Console</div>
          <h1>محادثات جذرة</h1>
          <p>لوحة متابعة مباشرة لرسائل العملاء، الردود البشرية، التقييمات والتنبيهات.</p>
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
            🔔 {soundEnabled ? "الصوت مفعل" : "تفعيل صوت التنبيهات"}
          </button>
          <button type="button" className="jth-refresh" onClick={() => refresh()}>
            تحديث الآن
          </button>
        </div>
      </header>

      <section className="jth-stats-grid">
        <div><strong>{stats.total}</strong><span>كل المحادثات</span></div>
        <div className="hot"><strong>{stats.waiting}</strong><span>بانتظار الرد</span></div>
        <div><strong>{stats.unread}</strong><span>رسائل غير مقروءة</span></div>
        <div><strong>{stats.closed}</strong><span>مغلقة</span></div>
      </section>

      <section className="jth-layout">
        <aside className="jth-sidebar">
          <div className="jth-tabs">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>الكل</button>
            <button className={filter === "waiting" ? "active" : ""} onClick={() => setFilter("waiting")}>تحتاج رد</button>
            <button className={filter === "closed" ? "active" : ""} onClick={() => setFilter("closed")}>مغلقة</button>
          </div>

          <div className="jth-conv-list">
            {filteredConversations.length === 0 ? (
              <div className="jth-empty">لا توجد محادثات في هذا التصنيف.</div>
            ) : (
              filteredConversations.map((conversation) => {
                const active = conversation.id === selectedId;
                const tone = statusTone(conversation);

                return (
                  <button
                    type="button"
                    key={conversation.id}
                    className={active ? "jth-conv active" : "jth-conv"}
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <div className="jth-conv-head">
                      <strong>{conversation.customer_name || conversation.visitor_id || "زائر"}</strong>
                      <span className={`pill ${tone}`}>{statusLabel(conversation)}</span>
                    </div>
                    <p>{conversation.last_message || "بدون رسالة"}</p>
                    <div className="jth-conv-foot">
                      <small>{formatDateTime(conversation.last_message_at)}</small>
                      {conversation.unread_admin_count > 0 ? (
                        <b>{conversation.unread_admin_count > 9 ? "9+" : conversation.unread_admin_count}</b>
                      ) : null}
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
                <div>
                  <div className="jth-customer-line">
                    <h2>{selectedConversation.customer_name || selectedConversation.visitor_id || "زائر"}</h2>
                    <span className={`pill ${statusTone(selectedConversation)}`}>{statusLabel(selectedConversation)}</span>
                  </div>
                  <p>
                    اللغة: {selectedConversation.language || "ar"} · آخر رسالة: {formatDateTime(selectedConversation.last_message_at)}
                  </p>
                  {selectedConversation.customer_phone || selectedConversation.customer_email ? (
                    <p className="jth-meta-line">
                      {selectedConversation.customer_phone || ""} {selectedConversation.customer_email ? `· ${selectedConversation.customer_email}` : ""}
                    </p>
                  ) : null}
                </div>

                <div className="jth-chat-buttons">
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
                            <div className="jth-sender">{senderLabel(message)}</div>
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
      </section>
    </main>
  );
}

const styles = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #061522; }
  .jth-admin-shell {
    min-height: 100vh;
    padding: 22px;
    color: #f8fbff;
    background:
      radial-gradient(circle at 20% 0%, rgba(39, 190, 131, .18), transparent 34%),
      radial-gradient(circle at 85% 10%, rgba(37, 99, 235, .16), transparent 38%),
      linear-gradient(135deg, #061522 0%, #071b2d 46%, #041018 100%);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .jth-topbar { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 16px; }
  .jth-kicker { color: #8be7ba; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; font-weight: 900; }
  h1 { margin: 5px 0 5px; font-size: 30px; }
  .jth-topbar p { margin: 0; color: #a9b8ca; }
  .jth-actions-top { display: flex; gap: 10px; align-items: center; }
  button { font-family: inherit; }
  .jth-sound, .jth-refresh { border: 1px solid rgba(255,255,255,.12); color: #fff; background: rgba(255,255,255,.08); border-radius: 14px; padding: 12px 14px; cursor: pointer; font-weight: 900; }
  .jth-sound.is-on { background: linear-gradient(135deg, #118d59, #24c76a); }
  .jth-stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; margin-bottom: 14px; }
  .jth-stats-grid div { background: rgba(255,255,255,.075); border: 1px solid rgba(255,255,255,.11); border-radius: 18px; padding: 14px; box-shadow: 0 18px 50px rgba(0,0,0,.22); }
  .jth-stats-grid .hot { background: linear-gradient(135deg, rgba(184, 60, 60, .28), rgba(255,255,255,.06)); border-color: rgba(255, 143, 143, .32); }
  .jth-stats-grid strong { display:block; font-size: 26px; }
  .jth-stats-grid span { color: #a9b8ca; font-size: 13px; }
  .jth-layout { display: grid; grid-template-columns: 380px minmax(0,1fr); gap: 16px; height: calc(100vh - 175px); }
  .jth-sidebar, .jth-chat-card { border: 1px solid rgba(255,255,255,.12); background: rgba(8, 28, 45, .82); backdrop-filter: blur(18px); border-radius: 24px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,.35); }
  .jth-sidebar { display:flex; flex-direction: column; }
  .jth-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
  .jth-tabs button { border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.055); color:#dbe7f5; border-radius: 13px; padding: 10px; cursor:pointer; font-weight: 800; }
  .jth-tabs button.active { background: #0b6b6c; color:#fff; }
  .jth-conv-list { padding: 12px; overflow:auto; }
  .jth-conv { width:100%; text-align:right; border:1px solid rgba(255,255,255,.09); color:#fff; background: rgba(255,255,255,.055); border-radius: 18px; padding: 13px; margin-bottom: 10px; cursor:pointer; transition:.18s ease; }
  .jth-conv:hover, .jth-conv.active { transform: translateY(-1px); border-color: rgba(137, 239, 188, .55); background: rgba(17, 92, 75, .34); }
  .jth-conv-head, .jth-conv-foot, .jth-customer-line, .jth-chat-buttons, .jth-reply-row { display:flex; align-items:center; gap:10px; justify-content:space-between; }
  .jth-conv p { margin: 8px 0; color:#d7e2ef; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .jth-conv small { color:#8fa1b7; }
  .jth-conv-foot b { min-width: 22px; height: 22px; border-radius: 99px; background:#f04444; display:inline-grid; place-items:center; font-size:12px; }
  .pill { display:inline-flex; align-items:center; border-radius:999px; padding: 5px 9px; font-size: 11px; font-weight: 900; }
  .pill.danger { color:#ffd6d6; background:rgba(239,68,68,.18); border:1px solid rgba(239,68,68,.28); }
  .pill.success { color:#baffd1; background:rgba(34,197,94,.16); border:1px solid rgba(34,197,94,.28); }
  .pill.ai { color:#bdeaff; background:rgba(14,165,233,.14); border:1px solid rgba(14,165,233,.26); }
  .pill.muted { color:#cbd5e1; background:rgba(148,163,184,.14); border:1px solid rgba(148,163,184,.24); }
  .jth-chat-card { display:flex; flex-direction:column; }
  .jth-chat-head { padding: 18px; display:flex; align-items:flex-start; justify-content:space-between; gap:14px; border-bottom:1px solid rgba(255,255,255,.08); background: linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025)); }
  .jth-chat-head h2 { margin:0; font-size: 22px; }
  .jth-chat-head p { margin:7px 0 0; color:#a9b8ca; font-size: 13px; }
  .jth-meta-line { color:#8be7ba!important; }
  .jth-chat-buttons button { border:0; border-radius:14px; padding: 11px 13px; color:#fff; font-weight:900; cursor:pointer; }
  .jth-chat-buttons .close { background: linear-gradient(135deg, #0d766e, #16a34a); }
  .jth-chat-buttons .delete { background: linear-gradient(135deg, #8b1d1d, #ef4444); }
  .jth-chat-buttons button:disabled { opacity:.45; cursor:not-allowed; }
  .jth-messages { flex:1; overflow:auto; padding: 20px; scroll-behavior: smooth; }
  .jth-day-separator { width:max-content; max-width: 90%; margin: 10px auto 16px; color:#9fb1c8; background:rgba(255,255,255,.065); border:1px solid rgba(255,255,255,.10); border-radius:999px; padding: 7px 13px; font-size: 12px; font-weight: 900; }
  .jth-message-row { display:flex; margin-bottom: 13px; }
  .jth-message-row.customer { justify-content:flex-start; }
  .jth-message-row.ai, .jth-message-row.human, .jth-message-row.system { justify-content:flex-end; }
  .jth-bubble { max-width:min(720px, 72%); padding: 13px 14px; border-radius: 18px; border:1px solid rgba(255,255,255,.10); box-shadow: 0 14px 32px rgba(0,0,0,.20); }
  .jth-message-row.customer .jth-bubble { background:#0d2c46; border-bottom-right-radius: 6px; }
  .jth-message-row.ai .jth-bubble { background:#0d3d29; border-bottom-left-radius: 6px; }
  .jth-message-row.human .jth-bubble { background:linear-gradient(135deg, #2f5f8f, #1d4f7c); border-bottom-left-radius: 6px; }
  .jth-message-row.system .jth-bubble { background:#2b3442; }
  .jth-sender { color:#b8c7da; font-size:12px; font-weight:900; margin-bottom: 6px; }
  .jth-bubble p { white-space:pre-wrap; margin:0; line-height:1.85; }
  .jth-bubble small, .jth-bubble time { display:block; margin-top:8px; color:rgba(255,255,255,.58); font-size:11px; }
  .jth-image-link { color:#8be7ba; font-weight:900; display:inline-block; margin-top:8px; }
  .jth-reply-panel { border-top:1px solid rgba(255,255,255,.08); padding: 13px; background:rgba(0,0,0,.14); }
  .jth-quick-replies { display:flex; gap:8px; overflow:auto; padding-bottom: 9px; }
  .jth-quick-replies button { flex:0 0 auto; border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.06); color:#e7eef8; border-radius: 999px; padding: 8px 11px; cursor:pointer; font-weight: 800; }
  .jth-reply-row textarea { flex:1; min-height:54px; max-height:130px; resize:vertical; border:1px solid rgba(255,255,255,.13); background:#061522; color:#fff; border-radius:16px; padding: 13px; font-family:inherit; outline:none; }
  .jth-reply-row .send, .jth-reply-row .emoji { border:0; border-radius:16px; height:54px; padding:0 18px; cursor:pointer; font-weight:900; color:#fff; }
  .jth-reply-row .send { background:linear-gradient(135deg, #0f766e, #22c55e); }
  .jth-reply-row .emoji { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.11); }
  .jth-emoji-bar { display:flex; gap:8px; padding-top:10px; }
  .jth-emoji-bar button { border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.06); border-radius:12px; padding: 8px 10px; cursor:pointer; }
  .jth-toast { position:fixed; z-index:9999; left:24px; bottom:24px; background:rgba(15,118,110,.96); color:#fff; border:1px solid rgba(255,255,255,.20); border-radius:18px; padding:14px 16px; box-shadow:0 18px 50px rgba(0,0,0,.35); font-weight:900; }
  .jth-empty { color:#a9b8ca; padding: 18px; }
  .jth-empty.center { margin:auto; text-align:center; }
  @media (max-width: 980px) {
    .jth-layout { grid-template-columns: 1fr; height:auto; }
    .jth-sidebar, .jth-chat-card { min-height: 460px; }
    .jth-stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .jth-topbar { flex-direction: column; }
  }
`;

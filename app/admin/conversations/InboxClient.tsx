"use client";

/**
 * لوحة محادثات جذرة — الإصدار 2
 * تصميم جديد كلياً (كمبيوتر / تابلت / جوال) مع أدوات تحكم إضافية.
 * النسخة القديمة محفوظة في AdminConversationsClient.tsx (للرجوع: غيّر الاستيراد في page.tsx).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Conversation = Record<string, any>;
type ChatMessage = Record<string, any>;

type InitialData = {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: ChatMessage[];
  selectedId: string | null;
};

type Filter = "all" | "waiting" | "unread" | "open" | "closed";
type QuickReply = { id: string; label: string; text: string };

const QR_KEY = "jth_admin_quick_replies_v2";
const THEME_KEY = "jth_admin_theme_v2";
const SOUND_KEY = "jth_admin_sound_v2";
const PUSH_OFF_KEY = "jothrah_admin_push_disabled_v1";
const PUSH_SYNC_KEY = "jothrah_admin_push_sync_at";

const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: "hi", label: "👋 ترحيب", text: "حيّاك الله، معك مهندس جذرة الزراعي 🌿 كيف أقدر أخدمك؟" },
  { id: "photo", label: "📷 صورة", text: "ممكن ترسل لي صورة واضحة للمشكلة أو للآفة عشان أشخّصها لك بدقة؟" },
  { id: "place", label: "📍 المكان", text: "المشكلة داخل البيت أو في الحديقة/المزرعة؟ وكم تقريباً المساحة؟" },
  { id: "crop", label: "🌱 المحصول", text: "وش نوع النبات أو المحصول؟ وكم عمره تقريباً؟" },
  { id: "safety", label: "🧤 السلامة", text: "اقرأ ملصق العبوة قبل الاستخدام، والبس قفازات وكمامة، وأبعد الأطفال والحيوانات عن المكان أثناء الرش وبعده لين يجف." },
  { id: "ship", label: "🚚 الشحن", text: "نوصل لجميع مدن المملكة عبر شركات الشحن المعتمدة، ويوصلك رقم التتبع برسالة بعد شحن الطلب." },
  { id: "code", label: "🎟️ خصم", text: "تقدر تستخدم كود الخصم JOTH10 عند إتمام الطلب 🌿" },
  { id: "wait", label: "⏳ لحظة", text: "لحظات وأرجع لك بالتفاصيل 🙏" },
  { id: "bye", label: "🙏 ختام", text: "سعدنا بخدمتك 🌿 إذا احتجت أي شي ثاني أنا موجود هنا." },
];

const EMOJIS = ["✅", "🌿", "🌱", "📷", "🙏", "👍", "😊", "✨", "💬", "🚚", "🧪", "⚠️", "📦", "💚"];

/* ------------------------------------------------------------------ */
/* أدوات                                                                */
/* ------------------------------------------------------------------ */
function fmt(value: string | undefined, opts: Intl.DateTimeFormatOptions) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", ...opts }).format(new Date(value));
  } catch {
    return "";
  }
}
const timeOf = (v?: string) => fmt(v, { hour: "numeric", minute: "2-digit" });
const dayOf = (v?: string) => fmt(v, { weekday: "long", day: "numeric", month: "long" });
const dateTimeOf = (v?: string) => fmt(v, { dateStyle: "medium", timeStyle: "short" });

function ts(v: unknown) {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : 0;
}
// فرق ساعة جهاز المدير عن ساعة الخادم (حتى لا يظهر "يكتب الآن" بالغلط)
let clockOffset = 0;
function isRecent(v: unknown, ms: number) {
  const t = ts(v);
  if (!t) return false;
  const diff = Date.now() + clockOffset - t;
  return diff > -1500 && diff < ms;
}
function relative(v?: string) {
  const t = ts(v);
  if (!t) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "الآن";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} س`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ي`;
  return fmt(v, { day: "numeric", month: "short" });
}
function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m >= 60 ? `${Math.floor(m / 60)}س ${m % 60}د` : `${m}:${String(r).padStart(2, "0")}`;
}
function cleanName(v: unknown) {
  const t = String(v || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (t.length < 2 || /^(jth|visitor|guest|v)_[a-z0-9_-]+$/i.test(t) || /jthrah_chat|customer_name_v\d|undefined|null/i.test(t)) return "";
  return t.slice(0, 80);
}
function customerName(c?: Conversation | null) {
  return cleanName(c?.customer_name) || cleanName(c?.customer_phone) || cleanName(c?.customer_email) || "زائر بدون اسم";
}
function initial(c?: Conversation | null) {
  const n = customerName(c);
  return n === "زائر بدون اسم" ? "ز" : n.slice(0, 1);
}
function avatarHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}
function isWaiting(c: Conversation) {
  return c.status === "needs_human" || Boolean(c.needs_human);
}
function statusInfo(c?: Conversation | null): { label: string; tone: string } {
  if (!c) return { label: "", tone: "muted" };
  if (c.status === "closed") return { label: "مغلقة", tone: "muted" };
  if (isWaiting(c)) return { label: "بانتظار المهندس", tone: "danger" };
  if (c.status === "human_replied") return { label: "تم الرد", tone: "ok" };
  return { label: "مع المساعد الذكي", tone: "ai" };
}
function cleanText(v: unknown) {
  return String(v || "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(رسالة\s+إضافية\s+لطلب\s+مختص|طلب\s+تواصل\s+بشري|طلب\s+مختص)\s*[:：\-–—]\s*/i, "")
    .trim();
}
function waPhone(phone?: string) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("966")) return d;
  if (d.startsWith("05")) return "966" + d.slice(1);
  if (d.startsWith("5") && d.length === 9) return "966" + d;
  return d;
}
function linkify(text: string) {
  const parts = String(text || "").split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="lnk">
        {part.includes("maps.google") ? "📍 فتح الموقع على الخريطة" : part.includes("jothrah.com") ? "🛒 فتح المنتج" : part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    [784, 1175, 1568].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * 0.12);
      o.stop(t0 + i * 0.12 + 0.55);
    });
  } catch {}
}
function b64ToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/* ------------------------------------------------------------------ */
/* المكوّن                                                               */
/* ------------------------------------------------------------------ */
export default function InboxClient({ initialData }: { initialData: InitialData }) {
  const [conversations, setConversations] = useState<Conversation[]>(initialData.conversations || []);
  const [selectedId, setSelectedId] = useState<string | null>(initialData.selectedId || null);
  const [selected, setSelected] = useState<Conversation | null>(initialData.selectedConversation || null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialData.messages || []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sound, setSound] = useState(true);
  const [push, setPush] = useState<"on" | "off" | "denied" | "unsupported" | "busy" | "unknown">("unknown");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tool, setTool] = useState<"" | "emoji" | "product" | "qr">("");
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(DEFAULT_QUICK_REPLIES);
  const [qrDraft, setQrDraft] = useState<QuickReply>({ id: "", label: "", text: "" });
  const [productQuery, setProductQuery] = useState("");
  const [products, setProducts] = useState<Array<Record<string, string>>>([]);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [jump, setJump] = useState(false);
  const [, tick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState("");

  const selectedRef = useRef<string | null>(selectedId);
  const seqRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const stickRef = useRef(true);
  const lastUnreadRef = useRef(-1);
  const lastCustomerMsgRef = useRef<string>("");
  const typingPingRef = useRef(0);
  const soundRef = useRef(true);

  /* ---- قائمة المحادثات على الجوال تتمرر مع الصفحة نفسها مثل الحجوزات والمالية،
         وتبقى الصفحة مثبتة فقط وقت فتح محادثة (عشان الكيبورد) ---- */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("cv-doc", !selectedId);
    if (selectedId) window.scrollTo(0, 0);
    return () => root.classList.remove("cv-doc");
  }, [selectedId]);

  /* ---- إعدادات محفوظة ---- */
  useEffect(() => {
    setMounted(true);
    document.cookie = "jothrah_admin_last=conversations; path=/; max-age=31536000; samesite=lax";
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "dark" || t === "light") setTheme(t);
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
      const s = localStorage.getItem(SOUND_KEY);
      if (s === "0") setSound(false);
      const q = JSON.parse(localStorage.getItem(QR_KEY) || "null");
      if (Array.isArray(q) && q.length) setQuickReplies(q);
    } catch {}
  }, []);
  useEffect(() => {
    soundRef.current = sound;
    try { localStorage.setItem(SOUND_KEY, sound ? "1" : "0"); } catch {}
  }, [sound]);
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
    document.documentElement.style.background = theme === "dark" ? "#0a1412" : "#eef2f0";
  }, [theme]);
  const saveQuickReplies = (next: QuickReply[]) => {
    setQuickReplies(next);
    try { localStorage.setItem(QR_KEY, JSON.stringify(next)); } catch {}
  };

  /* ---- ارتفاع الشاشة مع كيبورد الجوال ---- */
  useEffect(() => {
    const set = () => {
      const h = Math.floor(window.visualViewport?.height || window.innerHeight);
      document.documentElement.style.setProperty("--vvh", `${h}px`);
    };
    set();
    window.visualViewport?.addEventListener("resize", set);
    window.addEventListener("resize", set);
    return () => {
      window.visualViewport?.removeEventListener("resize", set);
      window.removeEventListener("resize", set);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  /* ---- التمرير ---- */
  const nearBottom = () => {
    const el = listRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };
  const toBottom = useCallback((force = false) => {
    if (!force && !stickRef.current) {
      setJump(true);
      return;
    }
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: "end" });
      setJump(false);
    });
  }, []);

  /* ---- جلب البيانات ---- */
  const inflightRef = useRef(false);
  const refresh = useCallback(async (force = false) => {
    // لا نرسل طلب جديد قبل ما يرجع السابق (كان يسبب "جاري تحميل الرسائل" بلا نهاية مع الشبكة البطيئة)
    if (inflightRef.current && !force) return;
    inflightRef.current = true;
    const id = selectedRef.current;
    try {
      const res = await fetch(id ? `/api/admin/conversations?id=${encodeURIComponent(id)}` : "/api/admin/conversations", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/admin/login?next=/admin/conversations";
        return;
      }
      const data = await res.json();
      if (data?.serverTime) clockOffset = ts(data.serverTime) - Date.now();
      if (!res.ok) return;
      const list: Conversation[] = data.conversations || [];
      const unread = list.reduce((s, c) => s + (Number(c.unread_admin_count) || 0), 0);
      const msgs: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
      const lastCustomer = [...msgs].reverse().find((m) => m.sender_type === "customer");
      const newInSelected = Boolean(lastCustomer?.id && lastCustomerMsgRef.current && lastCustomer.id !== lastCustomerMsgRef.current);
      if ((lastUnreadRef.current >= 0 && unread > lastUnreadRef.current) || newInSelected) {
        if (soundRef.current) playChime();
        flash("رسالة جديدة ✨");
      }
      lastUnreadRef.current = unread;
      if (lastCustomer?.id) lastCustomerMsgRef.current = lastCustomer.id;
      setConversations(list);
      if (id && selectedRef.current === id && data.selectedConversation?.id === id) {
        void seqRef;
        setSelected(data.selectedConversation);
        setMessages((cur) => {
          const pending = cur.filter((m) => m?.metadata?.pending && m.conversation_id === id && !msgs.some((n) => n.sender_type === "human" && n.message === m.message));
          return [...msgs, ...pending];
        });
      }
    } catch {
    } finally {
      inflightRef.current = false;
    }
  }, [flash]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden || Date.now() % 3 === 0) refresh();
    }, 2000);
    const onVis = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  useEffect(() => {
    toBottom(false);
  }, [messages.length, toBottom]);

  async function openConversation(id: string) {
    selectedRef.current = id;
    seqRef.current++;
    setSelectedId(id);
    const cached = conversations.find((c) => c.id === id) || null;
    setSelected(cached);
    setMessages([]);
    setTool("");
    setMenuOpen(false);
    stickRef.current = true;
    lastCustomerMsgRef.current = "";
    window.history.replaceState(null, "", `/admin/conversations?id=${id}`);
    await refresh(true);
    toBottom(true);
    if (window.innerWidth > 900) taRef.current?.focus();
  }
  function backToList() {
    selectedRef.current = null;
    seqRef.current++;
    setSelectedId(null);
    setSelected(null);
    setMessages([]);
    setDetailsOpen(false);
    window.history.replaceState(null, "", "/admin/conversations");
  }

  useEffect(() => {
    setNameDraft(cleanName(selected?.customer_name));
    setNoteDraft(String(selected?.metadata?.admin_note || ""));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- الإرسال ---- */
  async function send(textArg?: string) {
    const message = (textArg ?? reply).trim();
    const id = selectedId;
    if (!id || !message || message.length > 1200) return;
    const tempId = `temp-${Date.now()}`;
    if (textArg === undefined) setReply("");
    setTool("");
    stickRef.current = true;
    setMessages((cur) => [
      ...cur,
      { id: tempId, conversation_id: id, sender_type: "human", message, created_at: new Date().toISOString(), metadata: { pending: true } },
    ]);
    toBottom(true);
    try {
      const res = await fetch(`/api/admin/conversations/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "تعذر إرسال الرد");
      setMessages((cur) => cur.map((m) => (m.id === tempId && data?.message ? data.message : m)));
      refresh();
    } catch (e) {
      setMessages((cur) => cur.filter((m) => m.id !== tempId));
      if (textArg === undefined) setReply(message);
      flash(e instanceof Error ? e.message : "تعذر إرسال الرد");
    }
  }

  function pingTyping() {
    if (!selectedId || Date.now() - typingPingRef.current < 3000) return;
    typingPingRef.current = Date.now();
    fetch(`/api/admin/conversations/${selectedId}/typing`, { method: "POST" }).catch(() => {});
  }

  async function closeConversation() {
    if (!selectedId || !confirm("إنهاء المحادثة؟ سيظهر للعميل طلب تقييم الخدمة.")) return;
    setMenuOpen(false);
    const res = await fetch(`/api/admin/conversations/${selectedId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    flash(res.ok ? "تم إنهاء المحادثة ✅" : "تعذر إنهاء المحادثة");
    refresh();
  }
  async function deleteConversation() {
    if (!selectedId || !confirm("حذف المحادثة نهائياً مع كل رسائلها؟ لا يمكن التراجع.")) return;
    setMenuOpen(false);
    const res = await fetch(`/api/admin/conversations/${selectedId}/delete`, { method: "DELETE" });
    if (res.ok) {
      flash("تم حذف المحادثة");
      backToList();
      refresh();
    } else flash("تعذر حذف المحادثة");
  }
  async function saveName() {
    if (!selectedId || !nameDraft.trim()) return;
    const res = await fetch(`/api/admin/conversations/${selectedId}/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_name: nameDraft.trim() }),
    });
    flash(res.ok ? "تم حفظ الاسم ✅" : "تعذر حفظ الاسم");
    refresh();
  }
  async function saveNote() {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/conversations/${selectedId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteDraft }),
    });
    flash(res.ok ? "تم حفظ الملاحظة ✅" : "تعذر حفظ الملاحظة");
    refresh();
  }
  async function searchProducts(q: string) {
    setProductQuery(q);
    try {
      const res = await fetch(`/api/admin/products?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setProducts(Array.isArray(data.items) ? data.items : []);
    } catch {
      setProducts([]);
    }
  }
  function insertText(text: string) {
    setReply((cur) => (cur.trim() ? `${cur.trimEnd()}\n${text}` : text));
    setTool("");
    requestAnimationFrame(() => {
      taRef.current?.focus();
      autoGrow();
    });
  }
  function autoGrow() {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(160, Math.max(48, t.scrollHeight))}px`;
  }
  useEffect(autoGrow, [reply]);
  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(() => flash(`تم نسخ ${label}`)).catch(() => {});
  }

  /* ---- الإشعارات (Push) ---- */
  const enablePush = useCallback(async (interactive: boolean) => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPush("unsupported");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setPush("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setPush("denied");
        if (interactive) flash("الإشعارات مرفوضة من إعدادات المتصفح");
        return;
      }
      if (Notification.permission === "default") {
        if (!interactive) return setPush("off");
        setPush("busy");
        const p = await Notification.requestPermission();
        if (p !== "granted") return setPush(p === "denied" ? "denied" : "off");
      }
      const reg = (await navigator.serviceWorker.getRegistration("/")) || (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      const res = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error();
      localStorage.removeItem(PUSH_OFF_KEY);
      setPush("on");
      if (interactive) flash("إشعارات المحادثات مفعّلة ✅");
      try { localStorage.setItem(PUSH_SYNC_KEY, String(Date.now())); } catch {}
    } catch {
      // المزامنة الصامتة لو فشلت (نت ضعيف) ما نغيّر الحالة الظاهرة
      if (interactive) {
        setPush("off");
        flash("تعذر تفعيل الإشعارات");
      }
    }
  }, [flash]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return setPush("unsupported");
    if (localStorage.getItem(PUSH_OFF_KEY) === "1") return setPush("off");
    if (Notification.permission === "granted") {
      // مفعّلة: نعرضها مفعّلة فوراً، ونجدد الاشتراك بالخلفية مرة كل 12 ساعة بس
      setPush("on");
      const last = Number(localStorage.getItem(PUSH_SYNC_KEY) || 0);
      if (Date.now() - last > 12 * 3600 * 1000) enablePush(false);
    } else if (Notification.permission === "denied") setPush("denied");
    else setPush("off");
  }, [enablePush]);

  /* ---- تحديد متعدد: إنهاء / حذف دفعة وحدة ---- */
  function togglePick(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function runBulk(kind: "close" | "delete") {
    const ids = [...picked];
    if (!ids.length) return;
    const label = kind === "delete" ? "حذف" : "إنهاء";
    const msg =
      kind === "delete"
        ? `حذف ${ids.length} محادثة نهائياً مع كل رسائلها؟ لا يمكن التراجع.`
        : `إنهاء ${ids.length} محادثة؟ سيظهر لكل عميل طلب تقييم الخدمة.`;
    if (!confirm(msg)) return;
    let done = 0;
    let failed = 0;
    setBulkBusy(`${label} 0/${ids.length}`);
    const queue = [...ids];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift() as string;
        try {
          const res =
            kind === "delete"
              ? await fetch(`/api/admin/conversations/${id}/delete`, { method: "DELETE" })
              : await fetch(`/api/admin/conversations/${id}/close`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                });
          if (!res.ok) failed++;
        } catch {
          failed++;
        }
        done++;
        setBulkBusy(`${label} ${done}/${ids.length}`);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (kind === "delete" && selectedId && picked.has(selectedId)) backToList();
    setPicked(new Set());
    setSelectMode(false);
    setBulkBusy("");
    flash(failed ? `تم ${label} ${done - failed} وتعذر ${failed}` : `تم ${label} ${done} محادثة ✅`);
    refresh(true);
  }

  /* ---- اختصارات لوحة المفاتيح ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "Escape") {
        if (lightbox) return setLightbox(null);
        if (tool) return setTool("");
        if (menuOpen) return setMenuOpen(false);
        if (detailsOpen) return setDetailsOpen(false);
      }
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (lightbox && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const dir = e.key === "ArrowLeft" ? 1 : -1;
        setLightbox((lb) => (lb ? { ...lb, index: (lb.index + dir + lb.images.length) % lb.images.length } : lb));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, tool, menuOpen, detailsOpen]);

  /* ---- مشتقات ---- */
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      waiting: conversations.filter(isWaiting).length,
      unread: conversations.reduce((s, c) => s + (Number(c.unread_admin_count) || 0), 0),
      open: conversations.filter((c) => c.status !== "closed").length,
      today: conversations.filter((c) => new Date(c.created_at || c.last_message_at).toDateString() === today).length,
      rated: (() => {
        const r = conversations.map((c) => Number(c.rating) || 0).filter(Boolean);
        return r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1) : "—";
      })(),
    };
  }, [conversations]);

  useEffect(() => {
    document.title = stats.waiting ? `(${stats.waiting}) محادثات جذرة` : "محادثات جذرة";
  }, [stats.waiting]);

  const filtered = useMemo(() => {
    let items = conversations;
    if (filter === "waiting") items = items.filter(isWaiting);
    if (filter === "unread") items = items.filter((c) => Number(c.unread_admin_count) > 0);
    if (filter === "open") items = items.filter((c) => c.status !== "closed");
    if (filter === "closed") items = items.filter((c) => c.status === "closed");
    const q = query.trim().toLowerCase();
    if (q)
      items = items.filter((c) =>
        [c.customer_name, c.customer_phone, c.customer_email, c.last_message, c.visitor_id].filter(Boolean).join(" ").toLowerCase().includes(q),
      );
    // المنتظرين أولاً
    return [...items].sort((a, b) => (isWaiting(b) ? 1 : 0) - (isWaiting(a) ? 1 : 0) || ts(b.last_message_at) - ts(a.last_message_at));
  }, [conversations, filter, query]);

  const customerTyping = Boolean(selected && selected.status !== "closed" && isRecent(selected?.metadata?.customer_typing_at, 6000));
  const location = selected?.metadata?.location;
  const waitingSince = selected && isWaiting(selected) ? ts(selected.human_requested_at) : 0;
  const slashMatches = reply.startsWith("/") ? quickReplies.filter((q) => (q.label + q.text).includes(reply.slice(1).trim())) : [];

  /* ---- عرض رسالة ---- */
  function renderMessage(m: ChatMessage, prev?: ChatMessage) {
    const day = dayOf(m.created_at);
    const showDay = !prev || dayOf(prev.created_at) !== day;
    const dayEl = showDay ? <div className="day"><span>{day}</span></div> : null;
    const text = cleanText(m.message);
    const img = String(m.image_url || "");

    if (m.sender_type === "system") {
      if (m.metadata?.event === "customer_contact_card") {
        return (
          <div key={m.id}>
            {dayEl}
            <div className="card-contact">
              <b>🪪 بيانات العميل للتواصل</b>
              <div>{linkify(text.replace(/^بيانات العميل للتواصل:\s*/, ""))}</div>
              <small>تظهر لك فقط · {timeOf(m.created_at)}</small>
            </div>
          </div>
        );
      }
      return (
        <div key={m.id}>
          {dayEl}
          <div className="sys"><span>{text}</span></div>
        </div>
      );
    }

    const kind = m.sender_type === "customer" ? "in" : m.sender_type === "ai" ? "ai" : "out";
    const r = m.metadata?.fullResponse || {};
    const prods: any[] = m.metadata?.products || r.products || [];
    return (
      <div key={m.id}>
        {dayEl}
        <div className={`msg ${kind} ${m.metadata?.pending ? "pending" : ""}`}>
          <div className="bubble">
            <div className="who">
              {kind === "in" ? customerName(selected) : kind === "ai" ? "🤖 المساعد الذكي" : "👨‍🌾 مهندس جذرة"}
            </div>
            {img ? (
              <button type="button" className="img" onClick={() => setLightbox({ images: [img], index: 0 })}>
                <img src={img} alt="صورة من العميل" loading="lazy" />
              </button>
            ) : null}
            {text && !(img && /^(صورة مرفقة|Attached image)$/.test(text)) ? <p>{linkify(kind === "ai" ? r.summary || text : text)}</p> : null}
            {kind === "ai" && Array.isArray(r.advice) && r.advice.length ? (
              <ul>{r.advice.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
            ) : null}
            {kind === "ai" && prods.length ? (
              <div className="mini-prods">
                {prods.map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.image ? <img src={p.image} alt="" /> : null}
                    <span>{p.name}</span>
                  </a>
                ))}
              </div>
            ) : null}
            {kind === "ai" && m.ai_detected_problem ? <small className="diag">التشخيص: {m.ai_detected_problem}</small> : null}
            <time>
              {timeOf(m.created_at)}
              {m.metadata?.pending ? " · يرسل…" : null}
              {!m.metadata?.pending && kind === "out" ? (() => {
                const meta = (selected?.metadata || {}) as Record<string, unknown>;
                const at = Date.parse(m.created_at);
                const readAt = Date.parse(String(meta.customer_read_at || ""));
                const seenAt = Date.parse(String(meta.customer_seen_at || ""));
                // لو العميل كتب بعد ردك فأكيد قرأه (مثل الواتساب)
                const repliedAfter = messages.some((x) => x.sender_type === "customer" && Date.parse(x.created_at) > at);
                const read = repliedAfter || (Number.isFinite(readAt) && readAt >= at);
                const seen = read || (Number.isFinite(seenAt) && seenAt >= at);
                return (
                  <span className={`tk ${read ? "read" : seen ? "dlv" : ""}`} title={read ? "قرأها العميل" : seen ? "وصلت للعميل" : "تم الإرسال"}>
                    {" "}{seen ? "✓✓" : "✓"}{read ? " قرأها" : ""}
                  </span>
                );
              })() : null}
            </time>
          </div>
        </div>
      </div>
    );
  }

  const st = statusInfo(selected);
  const phone = String(selected?.customer_phone || "");
  const email = String(selected?.customer_email || "");

  /* ------------------------------------------------------------------ */
  /* قبل التحميل الكامل: نفس الشريط العلوي بالضبط (بدون وميض عند الانتقال من الحجوزات أو المالية) */
  if (!mounted)
    return (
      <main className="inbox light no-chat" dir="rtl">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <aside className="side">
          <nav className="adm-tabs" aria-label="أقسام لوحة الإدارة">
            <Link href="/admin/conversations" aria-current="page">💬 المحادثات</Link>
            <Link href="/admin/bookings" prefetch>📅 الحجوزات</Link>
            <Link href="/admin/finance" prefetch>💰 المالية</Link>
          </nav>
          <header className="brand">
            <div className="logo">ج</div>
            <div className="bt">
              <b>محادثات جذرة</b>
              <small>جاري التحميل…</small>
            </div>
          </header>
        </aside>
        <section className="chat" />
      </main>
    );

  return (
    <main className={`inbox ${theme} ${selectedId ? "has-chat" : "no-chat"} ${detailsOpen ? "details-on" : ""}`} dir="rtl">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ============ القائمة ============ */}
      <aside className="side">
        <nav className="adm-tabs" aria-label="أقسام لوحة الإدارة">
          <Link href="/admin/conversations" aria-current="page">💬 المحادثات</Link>
          <Link href="/admin/bookings" prefetch>📅 الحجوزات</Link>
          <Link href="/admin/finance" prefetch>💰 المالية</Link>
        </nav>
        <header className="brand">
          <div className="logo">ج</div>
          <div className="bt">
            <b>محادثات جذرة</b>
            <small>{stats.waiting ? `${stats.waiting} عميل بانتظارك` : "كل العملاء تم الرد عليهم 🌿"}</small>
          </div>
          <div className="tools">
            <button type="button" className="ic" title={sound ? "كتم الصوت" : "تشغيل الصوت"} onClick={() => setSound((v) => !v)}>
              {sound ? "🔔" : "🔕"}
            </button>
            <button type="button" className="ic" title="الوضع الليلي" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button type="button" className={`ic ${selectMode ? "on" : ""}`} title="تحديد عدة محادثات" onClick={() => { setSelectMode((v) => !v); setPicked(new Set()); }}>☑️</button>
            <button type="button" className="ic" title="تحديث" onClick={() => { refresh(); flash("تم التحديث"); }}>⟳</button>
          </div>
        </header>

        <div className="kpis">
          <button type="button" className={`kpi danger ${filter === "waiting" ? "on" : ""}`} onClick={() => setFilter(filter === "waiting" ? "all" : "waiting")}>
            <b>{stats.waiting}</b><span>بانتظار</span>
          </button>
          <button type="button" className={`kpi gold ${filter === "unread" ? "on" : ""}`} onClick={() => setFilter(filter === "unread" ? "all" : "unread")}>
            <b>{stats.unread}</b><span>غير مقروء</span>
          </button>
          <button type="button" className={`kpi ${filter === "open" ? "on" : ""}`} onClick={() => setFilter(filter === "open" ? "all" : "open")}>
            <b>{stats.open}</b><span>مفتوحة</span>
          </button>
          <div className="kpi plain"><b>{stats.rated}</b><span>التقييم ★</span></div>
        </div>

        {push !== "on" && push !== "unsupported" && push !== "unknown" ? (
          <button type="button" className="push-cta" onClick={() => enablePush(true)} disabled={push === "busy"}>
            {push === "denied" ? "⚠️ الإشعارات مرفوضة من إعدادات المتصفح" : push === "busy" ? "جاري التفعيل…" : "🔔 فعّل إشعارات الجوال عشان ما تفوتك رسالة"}
          </button>
        ) : null}

        <div className="search">
          <span>⌕</span>
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو الجوال أو الرسالة…" />
          {query ? <button type="button" onClick={() => setQuery("")}>×</button> : null}
        </div>

        <nav className="tabs">
          {([
            ["all", "الكل"],
            ["waiting", "بانتظار"],
            ["unread", "غير مقروء"],
            ["open", "مفتوحة"],
            ["closed", "مغلقة"],
          ] as Array<[Filter, string]>).map(([k, l]) => (
            <button type="button" key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </nav>

        {selectMode ? (
          <div className="bulk">
            <div className="bulk-top">
              <b>{picked.size} محددة</b>
              <button type="button" onClick={() => setPicked(picked.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)))}>
                {picked.size === filtered.length && filtered.length ? "إلغاء تحديد الكل" : `تحديد الكل (${filtered.length})`}
              </button>
              <button type="button" onClick={() => { setSelectMode(false); setPicked(new Set()); }}>إلغاء</button>
            </div>
            <div className="bulk-acts">
              <button type="button" className="btn ok" disabled={!picked.size || Boolean(bulkBusy)} onClick={() => runBulk("close")}>✅ إنهاء المحدد</button>
              <button type="button" className="btn danger" disabled={!picked.size || Boolean(bulkBusy)} onClick={() => runBulk("delete")}>🗑️ حذف المحدد</button>
            </div>
            {bulkBusy ? <small className="bulk-prog">جاري {bulkBusy}…</small> : null}
          </div>
        ) : null}

        <div className="list">
          {filtered.length === 0 ? <div className="empty-list">لا توجد محادثات هنا</div> : null}
          {filtered.map((c) => {
            const info = statusInfo(c);
            const waiting = isWaiting(c);
            const waitMs = waiting ? Date.now() - ts(c.human_requested_at || c.last_message_at) : 0;
            const unread = Number(c.unread_admin_count) || 0;
            const typing = isRecent(c.metadata?.customer_typing_at, 6000);
            return (
              <button type="button" key={c.id} className={`row ${c.id === selectedId ? "active" : ""} ${waiting ? "waiting" : ""} ${picked.has(c.id) ? "picked" : ""}`} onClick={() => (selectMode ? togglePick(c.id) : openConversation(c.id))}>
                {selectMode ? <span className={`chk ${picked.has(c.id) ? "on" : ""}`}>{picked.has(c.id) ? "✓" : ""}</span> : null}
                <span className="av" style={{ background: `hsl(${avatarHue(c.id)} 38% 34%)` }}>{initial(c)}</span>
                <span className="rb">
                  <span className="r1">
                    <b>{customerName(c)}</b>
                    <time>{relative(c.last_message_at)}</time>
                  </span>
                  <span className="r2">{typing ? <em>يكتب الآن…</em> : cleanText(c.last_message).split("\n")[0] || "بدون رسالة"}</span>
                  <span className="r3">
                    <i className={`pill ${info.tone}`}>{info.label}</i>
                    {waiting ? <i className={`timer ${waitMs > 300000 ? "late" : waitMs > 120000 ? "warn" : ""}`}>⏱ {mmss(waitMs)}</i> : null}
                    {c.rating ? <i className="stars">{"★".repeat(Number(c.rating))}</i> : null}
                    {c.metadata?.location ? <i className="loc">📍</i> : null}
                    {unread ? <i className="badge">{unread}</i> : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ============ المحادثة ============ */}
      <section className="chat">
        {selected ? (
          <>
            <header className="chat-hd">
              <button type="button" className="ic back" onClick={backToList} aria-label="رجوع">→</button>
              <span className="av lg" style={{ background: `hsl(${avatarHue(selected.id)} 38% 34%)` }}>{initial(selected)}</span>
              <div className="ct">
                <b>{customerName(selected)}</b>
                <small>
                  <i className={`pill ${st.tone}`}>{st.label}</i>
                  {customerTyping ? <em className="typing-txt">يكتب الآن…</em> : phone ? <span dir="ltr">{phone}</span> : null}
                  {waitingSince ? <i className="timer">⏱ {mmss(Date.now() - waitingSince)}</i> : null}
                </small>
              </div>
              <div className="acts">
                {phone ? (
                  <>
                    <a className="ic wa" href={`https://wa.me/${waPhone(phone)}`} target="_blank" rel="noopener noreferrer" title="واتساب">🟢</a>
                    <a className="ic" href={`tel:${phone}`} title="اتصال">📞</a>
                  </>
                ) : null}
                <button type="button" className={`ic ${detailsOpen ? "on" : ""}`} onClick={() => setDetailsOpen((v) => !v)} title="ملف العميل">👤</button>
                {selected.status !== "closed" ? (
                  <button type="button" className="btn ok" onClick={closeConversation}>إنهاء</button>
                ) : null}
                <div className="menu-wrap">
                  <button type="button" className="ic" onClick={() => setMenuOpen((v) => !v)} aria-label="المزيد">⋮</button>
                  {menuOpen ? (
                    <div className="menu">
                      <button type="button" onClick={() => { setDetailsOpen(true); setMenuOpen(false); }}>✏️ تعديل اسم العميل</button>
                      {phone ? <button type="button" onClick={() => copy(phone, "الجوال")}>📋 نسخ الجوال</button> : null}
                      <button type="button" onClick={() => copy(window.location.href, "رابط المحادثة")}>🔗 نسخ رابط المحادثة</button>
                      {selected.page_url ? <a href={selected.page_url} target="_blank" rel="noopener noreferrer">🛍️ الصفحة اللي كان فيها</a> : null}
                      <button type="button" className="danger" onClick={deleteConversation}>🗑️ حذف المحادثة نهائياً</button>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            <div
              className="msgs"
              ref={listRef}
              onScroll={() => {
                stickRef.current = nearBottom();
                if (stickRef.current) setJump(false);
              }}
            >
              {messages.length === 0 ? <div className="loading">جاري تحميل الرسائل…</div> : null}
              {messages.map((m, i) => renderMessage(m, messages[i - 1]))}
              {customerTyping ? (
                <div className="msg in"><div className="bubble typing"><i /><i /><i /> <small>{customerName(selected)} يكتب…</small></div></div>
              ) : null}
              {selected.status === "closed" ? (
                <div className="closed-note">
                  المحادثة مغلقة {selected.rating ? `· تقييم العميل ${"★".repeat(Number(selected.rating))}` : "· بانتظار تقييم العميل"}
                  {selected.rating_note ? <p>“{selected.rating_note}”</p> : null}
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
            {jump ? <button type="button" className="jump" onClick={() => { stickRef.current = true; toBottom(true); }}>↓ آخر الرسائل</button> : null}

            {selected.status !== "closed" ? (
              <footer className="composer">
                {tool === "qr" ? (
                  <div className="pop qr-mgr">
                    <div className="pop-hd"><b>إدارة الردود الجاهزة</b><button type="button" onClick={() => setTool("")}>×</button></div>
                    <div className="qr-list">
                      {quickReplies.map((q) => (
                        <div key={q.id} className="qr-item">
                          <button type="button" className="use" onClick={() => insertText(q.text)}><b>{q.label}</b><span>{q.text}</span></button>
                          <button type="button" className="mini" onClick={() => setQrDraft(q)}>✏️</button>
                          <button type="button" className="mini" onClick={() => saveQuickReplies(quickReplies.filter((x) => x.id !== q.id))}>🗑️</button>
                        </div>
                      ))}
                    </div>
                    <div className="qr-form">
                      <input value={qrDraft.label} onChange={(e) => setQrDraft({ ...qrDraft, label: e.target.value })} placeholder="العنوان (مثل: 🌿 تسميد)" />
                      <textarea value={qrDraft.text} onChange={(e) => setQrDraft({ ...qrDraft, text: e.target.value })} placeholder="نص الرد" rows={2} />
                      <div>
                        <button
                          type="button"
                          className="btn ok"
                          onClick={() => {
                            if (!qrDraft.label.trim() || !qrDraft.text.trim()) return;
                            const exists = quickReplies.some((q) => q.id === qrDraft.id);
                            saveQuickReplies(exists ? quickReplies.map((q) => (q.id === qrDraft.id ? qrDraft : q)) : [...quickReplies, { ...qrDraft, id: `q${Date.now()}` }]);
                            setQrDraft({ id: "", label: "", text: "" });
                          }}
                        >
                          {quickReplies.some((q) => q.id === qrDraft.id) ? "حفظ التعديل" : "إضافة رد"}
                        </button>
                        <button type="button" className="btn ghost" onClick={() => saveQuickReplies(DEFAULT_QUICK_REPLIES)}>استرجاع الافتراضي</button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {tool === "product" ? (
                  <div className="pop">
                    <div className="pop-hd"><b>🛒 أدرج منتج في الرد</b><button type="button" onClick={() => setTool("")}>×</button></div>
                    <input autoFocus className="pop-in" value={productQuery} onChange={(e) => searchProducts(e.target.value)} placeholder="اسم المنتج أو الآفة أو المادة الفعالة…" />
                    <div className="prod-list">
                      {products.map((p) => (
                        <button type="button" key={p.id} onClick={() => insertText(`${p.name}\n${p.url}`)}>
                          {p.image ? <img src={p.image} alt="" /> : <span />}
                          <b>{p.name}</b>
                        </button>
                      ))}
                      {!products.length ? <em>اكتب للبحث في منتجات المتجر</em> : null}
                    </div>
                  </div>
                ) : null}
                {tool === "emoji" ? (
                  <div className="pop emojis">
                    {EMOJIS.map((e) => <button type="button" key={e} onClick={() => { setReply((r) => r + e); taRef.current?.focus(); }}>{e}</button>)}
                  </div>
                ) : null}
                {slashMatches.length ? (
                  <div className="pop slash">
                    {slashMatches.slice(0, 6).map((q) => (
                      <button type="button" key={q.id} onClick={() => { setReply(q.text); taRef.current?.focus(); }}><b>{q.label}</b><span>{q.text}</span></button>
                    ))}
                  </div>
                ) : null}

                <div className="qr-bar">
                  {quickReplies.map((q) => (
                    <button type="button" key={q.id} title={q.text} onClick={() => insertText(q.text)}>{q.label}</button>
                  ))}
                  <button type="button" className="manage" onClick={() => setTool(tool === "qr" ? "" : "qr")}>⚙️ تعديل</button>
                </div>

                <div className="input-row">
                  <div className="input-tools">
                    <button type="button" className={`ic ${tool === "product" ? "on" : ""}`} title="إدراج منتج" onClick={() => { setTool(tool === "product" ? "" : "product"); if (!products.length) searchProducts(""); }}>🛒</button>
                    <button type="button" className={`ic ${tool === "emoji" ? "on" : ""}`} title="إيموجي" onClick={() => setTool(tool === "emoji" ? "" : "emoji")}>😊</button>
                  </div>
                  <textarea
                    ref={taRef}
                    value={reply}
                    rows={1}
                    placeholder="اكتب ردك…"
                    onChange={(e) => { setReply(e.target.value); pingTyping(); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.innerWidth > 900) {
                        e.preventDefault();
                        if (slashMatches.length === 1) return setReply(slashMatches[0].text);
                        send();
                      }
                    }}
                    onFocus={() => { stickRef.current = true; setTimeout(() => toBottom(true), 250); }}
                  />
                  <button type="button" className="send" disabled={!reply.trim() || reply.length > 1200} onClick={() => send()} aria-label="إرسال">
                    <svg width="20" height="20" viewBox="0 0 24 24" style={{ transform: "scaleX(-1)" }}><path d="M4 12 20 4l-6 16-2.5-6.5L4 12Z" fill="currentColor" /></svg>
                  </button>
                </div>
                <div className="hint">
                  <span>Enter للإرسال · Shift+Enter سطر جديد · اكتب / للردود الجاهزة</span>
                  <span className={reply.length > 1200 ? "over" : ""}>{reply.length}/1200</span>
                </div>
              </footer>
            ) : null}
          </>
        ) : (
          <div className="welcome">
            <div className="logo xl">ج</div>
            <h2>أهلاً بك في محادثات جذرة</h2>
            <p>اختر محادثة من القائمة للرد. العملاء اللي بانتظار المهندس يظهرون أولاً مع عدّاد وقت الانتظار.</p>
            <div className="wk">
              <div><b>{stats.waiting}</b><span>بانتظار الرد</span></div>
              <div><b>{stats.today}</b><span>محادثات اليوم</span></div>
              <div><b>{stats.open}</b><span>مفتوحة</span></div>
            </div>
            <small>اختصارات: «/» للبحث · Esc للإغلاق</small>
          </div>
        )}
      </section>

      {/* ============ ملف العميل ============ */}
      {selected ? (
        <>
          <button type="button" className="veil" aria-label="إغلاق" onClick={() => setDetailsOpen(false)} />
          <aside className="details">
            <header>
              <b>ملف العميل</b>
              <button type="button" className="ic" onClick={() => setDetailsOpen(false)}>×</button>
            </header>
            <div className="profile">
              <span className="av xl" style={{ background: `hsl(${avatarHue(selected.id)} 38% 34%)` }}>{initial(selected)}</span>
              <b>{customerName(selected)}</b>
              <i className={`pill ${st.tone}`}>{st.label}</i>
            </div>
            <div className="dsec">
              <label>الاسم</label>
              <div className="inline">
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="اسم العميل" />
                <button type="button" className="btn ok" onClick={saveName}>حفظ</button>
              </div>
            </div>
            <div className="dsec info">
              {phone ? <div><span>📱 الجوال</span><a href={`tel:${phone}`} dir="ltr">{phone}</a></div> : null}
              {email ? <div><span>✉️ البريد</span><a href={`mailto:${email}`}>{email}</a></div> : null}
              {phone ? <div><span>💬 واتساب</span><a href={`https://wa.me/${waPhone(phone)}`} target="_blank" rel="noopener noreferrer">فتح المحادثة</a></div> : null}
              <div><span>🗓️ بداية المحادثة</span><b>{dateTimeOf(selected.created_at)}</b></div>
              <div><span>🕒 آخر نشاط</span><b>{dateTimeOf(selected.last_message_at)}</b></div>
              <div><span>🌐 اللغة</span><b>{selected.language === "en" ? "English" : "العربية"}</b></div>
              <div><span>⭐ التقييم</span><b>{selected.rating ? `${"★".repeat(Number(selected.rating))} (${selected.rating}/5)` : "لم يقيّم بعد"}</b></div>
              {selected.page_url ? <div><span>🛍️ آخر صفحة</span><a href={selected.page_url} target="_blank" rel="noopener noreferrer">{decodeURIComponent(String(selected.page_url).replace(/^https?:\/\/[^/]+/, "")).slice(0, 40) || "الرئيسية"}</a></div> : null}
              <div><span>📱 الجهاز</span><b>{/iPhone|iPad/i.test(selected.user_agent || "") ? "آيفون" : /Android/i.test(selected.user_agent || "") ? "أندرويد" : /Mac/i.test(selected.user_agent || "") ? "ماك" : /Windows/i.test(selected.user_agent || "") ? "ويندوز" : "—"}</b></div>
            </div>
            {location?.lat ? (
              <div className="dsec">
                <label>📍 موقع العميل</label>
                <iframe
                  title="موقع العميل"
                  className="map"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.02},${location.lat - 0.015},${location.lng + 0.02},${location.lat + 0.015}&layer=mapnik&marker=${location.lat},${location.lng}`}
                />
                <a className="btn ghost full" href={`https://maps.google.com/?q=${location.lat},${location.lng}`} target="_blank" rel="noopener noreferrer">فتح في خرائط قوقل</a>
              </div>
            ) : null}
            <div className="dsec">
              <label>📝 ملاحظات داخلية (تظهر لك فقط)</label>
              <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={4} placeholder="مثال: يحتاج متابعة بعد أسبوع، عنده نخيل…" />
              <button type="button" className="btn ok full" onClick={saveNote}>حفظ الملاحظة</button>
            </div>
            <div className="dsec">
              {selected.status !== "closed" ? <button type="button" className="btn ghost full" onClick={closeConversation}>✅ إنهاء المحادثة وطلب التقييم</button> : null}
              <button type="button" className="btn danger full" onClick={deleteConversation}>🗑️ حذف المحادثة</button>
            </div>
          </aside>
        </>
      ) : null}

      {lightbox ? (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox.images[lightbox.index]} alt="" onClick={(e) => e.stopPropagation()} />
          <a href={lightbox.images[lightbox.index]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>فتح بالحجم الكامل ↗</a>
        </div>
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* التصميم                                                               */
/* ------------------------------------------------------------------ */
const CSS = `
html,body{margin:0;padding:0;height:100%;overflow:hidden;max-width:100%;overscroll-behavior:none}
.inbox{--bg:#e9efec;--panel:#ffffff;--panel2:#f6f8f7;--ink:#0f1f1c;--mut:#5a6b66;--line:#dbe4e0;--brand:#0b4a42;--brand2:#083a33;--brandsoft:#e3f0ec;--gold:#b8862b;--goldsoft:#f8eed8;--danger:#c0392b;--dangersoft:#fdecea;--ok:#1d7f4b;--oksoft:#e4f4ea;--ai:#4b5bb3;--aisoft:#eceefb;--in:#ffffff;--out:#0b4a42;--shadow:0 10px 30px rgba(9,40,35,.08);
  font-family:'IBM Plex Sans Arabic',system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--ink);background:var(--bg);
  height:var(--vvh,100dvh);width:100%;max-width:100vw;display:grid;grid-template-columns:380px minmax(0,1fr);gap:0;overflow:hidden;font-size:14.5px}
.inbox.dark{--bg:#0a1412;--panel:#101d1a;--panel2:#152622;--ink:#e7efec;--mut:#94a8a2;--line:#22362f;--brand:#1f8a73;--brand2:#18705e;--brandsoft:#16312b;--gold:#d9a84a;--goldsoft:#2b2414;--danger:#ef6b5c;--dangersoft:#3a1d19;--ok:#3fbf7f;--oksoft:#16301f;--ai:#8d9cf0;--aisoft:#1e2340;--in:#152622;--out:#1f6f5e;--shadow:0 10px 30px rgba(0,0,0,.35)}
.inbox.details-on{grid-template-columns:380px minmax(0,1fr) 340px}
.inbox *{box-sizing:border-box;font-family:inherit}
.inbox button{cursor:pointer;color:inherit}
.inbox input,.inbox textarea{color:var(--ink);background:var(--panel);border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;font-size:14.5px;outline:none;width:100%}
.inbox input:focus,.inbox textarea:focus{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 18%,transparent)}
.ic{width:38px;height:38px;border-radius:12px;border:1px solid var(--line);background:var(--panel);display:inline-grid;place-items:center;font-size:16px;text-decoration:none;flex:none;transition:.15s}
.ic:hover,.ic.on{background:var(--brandsoft);border-color:var(--brand)}
.btn{border:0;border-radius:12px;padding:9px 16px;font-weight:700;font-size:14px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn.ok{background:var(--brand);color:#fff}.btn.ok:hover{background:var(--brand2)}
.btn.ghost{background:var(--panel2);border:1px solid var(--line);color:var(--ink)}
.btn.danger{background:var(--dangersoft);color:var(--danger)}
.btn.full{width:100%;margin-top:8px}
.pill{font-style:normal;font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:999px;white-space:nowrap}
.pill.danger{background:var(--dangersoft);color:var(--danger)}.pill.ok{background:var(--oksoft);color:var(--ok)}.pill.ai{background:var(--aisoft);color:var(--ai)}.pill.muted{background:var(--panel2);color:var(--mut)}
.timer{font-style:normal;font-size:11.5px;font-weight:700;color:var(--ok);font-variant-numeric:tabular-nums}.timer.warn{color:var(--gold)}.timer.late{color:var(--danger)}
.av{width:44px;height:44px;border-radius:14px;color:#fff;display:grid;place-items:center;font-weight:700;font-size:18px;flex:none}
.av.lg{width:42px;height:42px}.av.xl{width:76px;height:76px;border-radius:24px;font-size:32px}
.logo{width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,var(--brand),var(--brand2));color:#f3d58f;display:grid;place-items:center;font-weight:800;font-size:20px;box-shadow:0 0 0 2px color-mix(in srgb,var(--gold) 55%,transparent);flex:none}
.logo.xl{width:84px;height:84px;border-radius:28px;font-size:40px}

/* القائمة */
.side{background:var(--panel);border-left:1px solid var(--line);display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}
.adm-tabs{display:flex;gap:6px;padding:12px 16px 0}.adm-tabs a{flex:1;text-align:center;text-decoration:none;font-weight:700;font-size:14px;padding:10px 8px;border-radius:12px;color:var(--ink);background:var(--panel2);border:1px solid var(--line)}.adm-tabs a[aria-current=page]{background:var(--brand);color:#fff;border-color:var(--brand)}.adm-tabs a:focus-visible{outline:3px solid var(--gold);outline-offset:2px}.brand{display:flex;align-items:center;gap:11px;padding:16px 16px 12px}
.brand .bt{flex:1;min-width:0}.brand b{display:block;font-size:17px}.brand small{color:var(--mut);font-size:12.5px}
.brand .tools{display:flex;gap:6px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 16px 12px}
.kpi{border:1px solid var(--line);background:var(--panel2);border-radius:14px;padding:8px 4px;text-align:center;display:flex;flex-direction:column;gap:1px}
.kpi b{font-size:20px;line-height:1.2}.kpi span{font-size:11.5px;color:var(--mut);font-weight:600}
.kpi.danger b{color:var(--danger)}.kpi.gold b{color:var(--gold)}.kpi.on{border-color:var(--brand);background:var(--brandsoft)}.kpi.plain{cursor:default}
.push-cta{margin:0 16px 12px;border:1px dashed var(--gold);background:var(--goldsoft);color:var(--gold);border-radius:12px;padding:9px;font-weight:700;font-size:13px}
.search{margin:0 16px 10px;position:relative}
.search span{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--mut);font-size:18px}
.search input{padding-right:36px;background:var(--panel2)}
.search button{position:absolute;left:8px;top:50%;transform:translateY(-50%);border:0;background:none;font-size:18px;color:var(--mut)}
.tabs{display:flex;gap:6px;padding:0 16px 10px;overflow-x:auto;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
.tabs button{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 13px;font-size:13px;font-weight:600;white-space:nowrap}
.tabs button.on{background:var(--brand);border-color:var(--brand);color:#fff}
.list{flex:1;min-width:0;overflow-x:hidden;overflow-y:auto;padding:4px 10px 16px;overscroll-behavior:contain}
.bulk{margin:0 16px 10px;border:1px solid var(--line);background:var(--panel2);border-radius:14px;padding:10px}
.bulk-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}.bulk-top b{flex:1;font-size:14px}
.bulk-top button{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:600}
.bulk-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bulk-acts .btn{padding:9px 8px;font-size:13px}.bulk-acts .btn:disabled{opacity:.45;cursor:default}
.bulk-prog{display:block;margin-top:6px;color:var(--mut);font-weight:600}
.chk{width:24px;height:24px;border-radius:8px;border:2px solid var(--line);display:grid;place-items:center;flex:none;align-self:center;font-weight:800;color:#fff;background:var(--panel)}
.chk.on{background:var(--brand);border-color:var(--brand)}
.row.picked{background:var(--brandsoft)}
.empty-list{text-align:center;color:var(--mut);padding:40px 0}
.row{width:100%;max-width:100%;min-width:0;overflow:hidden;display:flex;gap:11px;align-items:flex-start;text-align:right;border:1px solid transparent;background:none;border-radius:16px;padding:11px 10px;margin-bottom:2px;transition:.12s}
.row:hover{background:var(--panel2)}
.row.active{background:var(--brandsoft);border-color:color-mix(in srgb,var(--brand) 35%,transparent)}
.row.waiting{box-shadow:inset -3px 0 0 var(--danger)}
.rb{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.r1{display:flex;justify-content:space-between;gap:8px;align-items:baseline;min-width:0}
.r1 b{font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.r1 time{font-size:11.5px;color:var(--mut);flex:none}
.r2{font-size:13px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.r2 em{color:var(--ok);font-style:normal;font-weight:700}
.r3{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.stars{font-style:normal;color:var(--gold);font-size:11px;letter-spacing:-1px}.loc{font-style:normal;font-size:12px}
.badge{font-style:normal;margin-right:auto;background:var(--danger);color:#fff;min-width:22px;height:22px;padding:0 7px;border-radius:999px;font-size:12px;font-weight:700;display:grid;place-items:center}

/* المحادثة */
.chat{display:flex;flex-direction:column;min-width:0;overflow:hidden;min-height:0;position:relative;background:var(--bg);
  background-image:radial-gradient(circle at 1px 1px,color-mix(in srgb,var(--brand) 9%,transparent) 1px,transparent 0);background-size:22px 22px}
.chat-hd{display:flex;align-items:center;gap:11px;padding:12px 18px;background:var(--panel);border-bottom:1px solid var(--line);box-shadow:var(--shadow);z-index:2}
.chat-hd .back{display:none}
.ct{flex:1;min-width:0}.ct b{display:block;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ct small{display:flex;gap:8px;align-items:center;color:var(--mut);font-size:12.5px;flex-wrap:wrap}
.typing-txt{color:var(--ok);font-style:normal;font-weight:700}
.acts{display:flex;gap:6px;align-items:center}
.menu-wrap{position:relative}
.menu{position:absolute;top:44px;left:0;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:6px;min-width:220px;z-index:20;display:flex;flex-direction:column}
.menu button,.menu a{border:0;background:none;text-align:right;padding:10px 12px;border-radius:10px;font-size:14px;text-decoration:none;color:var(--ink)}
.menu button:hover,.menu a:hover{background:var(--panel2)}.menu .danger{color:var(--danger)}
.msgs{flex:1;overflow-y:auto;padding:18px max(18px,4%) 10px;overscroll-behavior:contain}
.loading{text-align:center;color:var(--mut);padding:30px}
.day{text-align:center;margin:14px 0 10px}.day span{background:var(--panel);border:1px solid var(--line);color:var(--mut);font-size:12px;font-weight:600;padding:4px 14px;border-radius:999px}
.sys{text-align:center;margin:8px 0}.sys span{background:var(--goldsoft);color:var(--gold);font-size:12.5px;font-weight:700;padding:4px 14px;border-radius:999px}
.card-contact{margin:10px auto;max-width:440px;background:var(--panel);border:1.5px solid var(--gold);border-radius:16px;padding:12px 14px;white-space:pre-line;line-height:1.9}
.card-contact b{color:var(--gold)}.card-contact small{display:block;color:var(--mut);font-size:11.5px}
.msg{display:flex;margin:6px 0}.msg.in{justify-content:flex-start}.msg.out,.msg.ai{justify-content:flex-end}
.bubble{max-width:min(620px,78%);padding:10px 14px 8px;border-radius:18px;background:var(--in);border:1px solid var(--line);box-shadow:0 2px 6px rgba(0,0,0,.04);word-wrap:break-word;overflow-wrap:anywhere}
.msg.in .bubble{border-top-right-radius:6px}
.msg.out .bubble{background:var(--out);color:#fff;border-color:transparent;border-top-left-radius:6px}
.msg.ai .bubble{background:var(--aisoft);border-color:color-mix(in srgb,var(--ai) 25%,transparent);border-top-left-radius:6px}
.msg.pending .bubble{opacity:.65}
.who{font-size:12px;font-weight:700;opacity:.8;margin-bottom:2px}
.bubble p{margin:2px 0;white-space:pre-line;line-height:1.75}
.bubble ul{margin:6px 0 2px;padding-right:18px}.bubble li{margin:2px 0}
.bubble time{display:block;font-size:11px;opacity:.65;margin-top:4px;text-align:left}.bubble .tk{font-weight:800;letter-spacing:-1px}.bubble .tk.read{color:#53bdeb;opacity:1;letter-spacing:0}.msg.out .bubble time:has(.tk.read){opacity:1}
.bubble .img{border:0;padding:0;background:none;display:block;margin:4px 0}.bubble .img img{max-width:260px;max-height:260px;border-radius:12px;display:block;cursor:zoom-in}
.lnk{color:inherit;font-weight:700;text-decoration:underline;word-break:break-all}
.diag{display:block;color:var(--mut);font-size:12px;margin-top:4px}
.mini-prods{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.mini-prods a{display:flex;gap:6px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:4px 8px 4px 4px;font-size:12px;text-decoration:none;color:var(--ink);max-width:240px}
.mini-prods img{width:30px;height:30px;object-fit:contain;border-radius:6px;background:#fff}
.mini-prods span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.typing{display:inline-flex;gap:4px;align-items:center}.typing i{width:7px;height:7px;border-radius:50%;background:var(--ok);animation:bl 1.2s infinite}.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}.typing small{color:var(--mut);margin-right:6px}
@keyframes bl{0%,80%,100%{opacity:.25}40%{opacity:1}}
.closed-note{text-align:center;margin:16px auto;max-width:420px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px;color:var(--mut);font-weight:600}
.closed-note p{margin:6px 0 0;color:var(--ink)}
.jump{position:absolute;bottom:190px;left:50%;transform:translateX(-50%);border:0;background:var(--brand);color:#fff;border-radius:999px;padding:8px 16px;font-weight:700;box-shadow:var(--shadow);z-index:3}
.composer{background:var(--panel);border-top:1px solid var(--line);padding:10px 16px calc(10px + env(safe-area-inset-bottom));position:relative}
.qr-bar{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:thin}
.qr-bar button{flex:none;border:1px solid var(--line);background:var(--panel2);border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:600;white-space:nowrap}
.qr-bar button:hover{border-color:var(--brand);background:var(--brandsoft)}
.qr-bar .manage{border-style:dashed;color:var(--mut)}
.input-row{display:flex;gap:8px;align-items:flex-end}
.input-tools{display:flex;gap:6px;padding-bottom:4px}
.input-row textarea{flex:1;resize:none;min-height:48px;max-height:160px;border-radius:16px;line-height:1.6;font-size:15px}
.send{width:48px;height:48px;border-radius:16px;border:0;background:var(--brand);color:#fff;display:grid;place-items:center;flex:none}
.send:disabled{opacity:.4;cursor:default}
.hint{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mut);margin-top:5px}.hint .over{color:var(--danger);font-weight:700}
.pop{position:absolute;bottom:calc(100% - 4px);right:16px;left:16px;background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:10px;z-index:10;max-height:min(420px,55vh);overflow:auto}
.pop-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.pop-hd button{border:0;background:none;font-size:22px;color:var(--mut)}
.pop-in{margin-bottom:8px}
.prod-list{display:grid;gap:4px}
.prod-list button{display:flex;gap:10px;align-items:center;text-align:right;border:0;background:var(--panel2);border-radius:12px;padding:6px 8px}
.prod-list button:hover{background:var(--brandsoft)}
.prod-list img,.prod-list span{width:40px;height:40px;object-fit:contain;background:#fff;border-radius:8px;flex:none}
.prod-list b{font-size:13px;font-weight:600}.prod-list em{color:var(--mut);padding:8px}
.emojis{display:flex;flex-wrap:wrap;gap:4px;right:auto;width:300px}.emojis button{border:0;background:none;font-size:22px;padding:4px;border-radius:8px}.emojis button:hover{background:var(--panel2)}
.slash{display:grid;gap:4px}.slash button,.qr-item .use{border:0;background:var(--panel2);border-radius:12px;padding:8px 10px;text-align:right;display:flex;flex-direction:column;gap:2px}
.slash span,.qr-item .use span{font-size:12px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.qr-list{display:grid;gap:4px;margin-bottom:10px}
.qr-item{display:flex;gap:4px;align-items:center}.qr-item .use{flex:1;min-width:0}
.mini{border:1px solid var(--line);background:var(--panel);border-radius:10px;width:34px;height:34px;flex:none}
.qr-form{display:grid;gap:6px;border-top:1px solid var(--line);padding-top:10px}.qr-form div{display:flex;gap:6px}

/* الترحيب */
.welcome{margin:auto;text-align:center;max-width:440px;padding:30px}
.welcome .logo{margin:0 auto 14px}
.welcome h2{margin:0 0 6px;font-size:22px}.welcome p{color:var(--mut);line-height:1.8}
.wk{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
.wk div{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:12px}.wk b{display:block;font-size:24px;color:var(--brand)}.wk span{font-size:12px;color:var(--mut)}
.welcome small{color:var(--mut)}

/* ملف العميل */
.details{background:var(--panel);border-right:1px solid var(--line);overflow-y:auto;display:none;flex-direction:column}
.details-on .details{display:flex}
.details header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--panel);z-index:1}
.profile{display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 16px 8px}.profile b{font-size:17px}
.dsec{padding:12px 16px;border-bottom:1px solid var(--line)}
.dsec label{display:block;font-size:12.5px;font-weight:700;color:var(--mut);margin-bottom:6px}
.inline{display:flex;gap:6px}
.info div{display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:13.5px}
.info span{color:var(--mut)}.info a{color:var(--brand);font-weight:700;text-decoration:none;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.info b{font-weight:600;text-align:left}
.map{width:100%;height:190px;border:0;border-radius:14px;display:block}
.veil{display:none}

.lightbox{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:zoom-out}
.lightbox img{max-width:94vw;max-height:84vh;border-radius:14px}
.lightbox a{color:#fff;font-weight:700}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--panel);padding:10px 18px;border-radius:12px;font-weight:700;z-index:120;box-shadow:var(--shadow)}

/* تابلت */
@media (max-width:1280px){
  .inbox,.inbox.details-on{grid-template-columns:340px minmax(0,1fr)}
  .details{position:fixed;top:0;bottom:0;left:0;width:min(360px,92vw);z-index:60;box-shadow:var(--shadow)}
  .details-on .veil{display:block;position:fixed;inset:0;background:rgba(0,0,0,.35);border:0;z-index:55}
}
/* جوال */
@media (max-width:900px){
  .inbox,.inbox.details-on{grid-template-columns:1fr}
  .inbox.has-chat .side{display:none}
  .inbox.no-chat .chat{display:none}
  .chat-hd{padding:10px 12px;gap:8px}
  .chat-hd .back{display:inline-grid}
  .acts .btn{padding:8px 11px}
  .acts .wa,.acts a[href^="tel"]{display:none}
  .msgs{padding:12px 10px 8px}
  .bubble{max-width:88%}
  .composer{padding:8px 10px calc(8px + env(safe-area-inset-bottom))}
  .hint{display:none}
  .input-row textarea{font-size:16px}
  .details{width:100%;top:auto;height:88%;border-radius:22px 22px 0 0;bottom:0}
  .jump{bottom:150px}
  .brand{padding:12px 12px 10px}.brand b{font-size:16px}.brand .tools{gap:4px}.brand .ic{width:34px;height:34px;font-size:14px}
  .kpis{gap:6px;padding:0 12px 10px}.kpi{padding:6px 2px;border-radius:12px}.kpi b{font-size:17px}.kpi span{font-size:10.5px}
  .search,.push-cta{margin-left:12px;margin-right:12px}.tabs{padding:0 12px 8px}.tabs button{padding:5px 11px;font-size:12.5px}
  .list{padding:2px 6px 12px}.row{padding:10px 8px;gap:9px}.av{width:40px;height:40px;font-size:16px}
  .ct small{flex-wrap:nowrap;overflow:hidden}.ct small span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}

/* ===== ثيم موحّد مع لوحة حجوزات الرش (ألوان المتجر) ===== */
html,body{background:#0b2e1f}
.inbox:not(.dark){--bg:#f5f8f6;--panel2:#f2f6f3;--ink:#0b2e1f;--mut:#5f7a6c;--line:#e3ece6;--brand:#0b2e1f;--brand2:#173f2e;--brandsoft:#e6f0ea;--gold:#a8781c;--goldsoft:#fff7e3;--out:#0b2e1f}
.adm-tabs{background:#0b2e1f;padding:calc(12px + env(safe-area-inset-top)) 16px 0}
.adm-tabs a{background:#173f2e;color:#d5e4dc;border-color:transparent;white-space:nowrap;padding-inline:4px}
.adm-tabs a[aria-current=page]{background:#e2b64c;color:#0b2e1f;border-color:#e2b64c}
.adm-tabs a:focus-visible{outline-color:#fff}
.brand{background:#0b2e1f;color:#fff;padding:14px 16px 16px;margin-bottom:12px}
.brand small{color:#b9cfc3}
.brand .ic{background:#173f2e;border-color:#2a5a44;color:#fff}
.brand .ic:hover,.brand .ic.on{background:#24503b;border-color:#e2b64c}
.logo{background:#e2b64c;color:#0b2e1f;box-shadow:none}
.chat-hd{background:#0b2e1f;color:#fff;border-bottom:0;padding-top:calc(12px + env(safe-area-inset-top))}
.chat-hd small{color:#b9cfc3}
.chat-hd .ic{background:#173f2e;border-color:#2a5a44;color:#fff}
.chat-hd .ic:hover,.chat-hd .ic.on{background:#24503b;border-color:#e2b64c}
.chat-hd .btn.ok{background:#e2b64c;color:#0b2e1f}.chat-hd .btn.ok:hover{background:#ecc664}
.chat-hd .btn.ghost{background:#173f2e;border-color:#2a5a44;color:#fff}
.chat-hd .typing-txt{color:#f3d68a}
@media (max-width:900px){.chat-hd{padding-top:calc(10px + env(safe-area-inset-top))}}
@media (max-width:900px){
  .side{border-left:0}
  html.cv-doc,html.cv-doc body{height:auto;overflow-x:hidden;overflow-y:visible}
  html.cv-doc .inbox{height:auto;min-height:100dvh;overflow:visible}
  html.cv-doc .side{overflow:visible;min-height:100dvh}
  html.cv-doc .list{flex:none;overflow:visible}
  html.cv-doc .adm-tabs{position:sticky;top:0;z-index:30}
}
`;

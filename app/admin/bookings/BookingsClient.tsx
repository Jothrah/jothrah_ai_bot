"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BOOKING_STATUSES, STATUS_LABELS, type BookingStatus } from "@/lib/bookings";

type Booking = {
  id: string;
  ref: string;
  created_at: string;
  updated_at: string;
  status: BookingStatus;
  customer_name: string;
  customer_phone: string;
  district: string;
  address_note: string | null;
  place_type: string | null;
  place_size: string | null;
  pests: string[] | null;
  pest_note: string | null;
  preferred_date: string | null;
  preferred_period: string | null;
  lat: number | null;
  lng: number | null;
  location_accuracy: number | null;
  customer_notes: string | null;
  admin_note: string | null;
  confirmed_date: string | null;
  confirmed_time: string | null;
  price: number | string | null;
  source: string | null;
};

const PUSH_OFF_KEY = "jothrah_admin_push_disabled_v1";
const PUSH_SYNC_KEY = "jothrah_admin_push_sync_at";

function b64ToBytes(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("ar-SA-u-ca-gregory", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return d;
  }
}

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "الحين";
  if (s < 3600) return `قبل ${Math.floor(s / 60)} د`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} س`;
  return new Date(iso).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });
}

function localPhone(p: string) {
  return p.startsWith("966") ? "0" + p.slice(3) : p;
}

function waLink(b: Booking, text: string) {
  return `https://wa.me/${b.customer_phone}?text=${encodeURIComponent(text)}`;
}

function confirmText(b: Booking) {
  const parts = [`حياك الله ${b.customer_name}، معك جذرة بخصوص طلب رش المنازل رقم ${b.ref}.`];
  if (b.confirmed_date) {
    parts.push(
      `نأكد لك الموعد يوم ${fmtDate(b.confirmed_date)}${b.confirmed_time ? ` الساعة ${b.confirmed_time}` : ""} في حي ${b.district}.`,
    );
  }
  if (b.price !== null && b.price !== "" && b.price !== undefined) parts.push(`المبلغ: ${b.price} ريال.`);
  return parts.join("\n");
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "#b7791f",
  contacted: "#2b6cb0",
  confirmed: "#2f7d4e",
  done: "#4a5568",
  cancelled: "#c53030",
};

export default function BookingsClient({
  initialBookings,
  initialSelectedId,
  loadError,
}: {
  initialBookings: Booking[];
  initialSelectedId: string;
  loadError: string;
}) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [filter, setFilter] = useState<"all" | "open" | BookingStatus>("open");
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [toast, setToast] = useState(loadError);
  const [push, setPush] = useState<"on" | "off" | "busy" | "denied" | "unsupported" | "unknown">("unknown");
  const [search, setSearch] = useState("");
  const knownIds = useRef(new Set(initialBookings.map((b) => b.id)));
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.cookie = "jothrah_admin_last=bookings; path=/; max-age=31536000; samesite=lax";
  }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bookings", { cache: "no-store" });
      if (res.status === 401) {
        location.href = "/admin/login?next=/admin/bookings";
        return;
      }
      const j = await res.json();
      if (!j.ok) return;
      const list: Booking[] = j.bookings;
      const added = list.filter((b) => !knownIds.current.has(b.id)).map((b) => b.id);
      list.forEach((b) => knownIds.current.add(b.id));
      if (added.length) {
        setFresh((cur) => new Set([...cur, ...added]));
        flash(added.length === 1 ? "وصل حجز جديد" : `وصلت ${added.length} حجوزات جديدة`);
      }
      setBookings(list);
    } catch {
      /* نتجاهل أخطاء الشبكة المؤقتة */
    }
  }, [flash]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  /* ---- تنبيهات الجوال (نفس اشتراك المحادثات) ---- */
  const enablePush = useCallback(
    async (interactive: boolean) => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setPush("unsupported");
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) return setPush("unsupported");
        if (Notification.permission === "denied") {
          setPush("denied");
          if (interactive) flash("التنبيهات مرفوضة من إعدادات المتصفح");
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
        if (interactive) flash("تنبيهات الحجوزات والمحادثات مفعّلة ✅");
        try { localStorage.setItem(PUSH_SYNC_KEY, String(Date.now())); } catch {}
      } catch {
        if (interactive) {
          setPush("off");
          flash("تعذر تفعيل التنبيهات");
        }
      }
    },
    [flash],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPush("unsupported");
      return;
    }
    if (localStorage.getItem(PUSH_OFF_KEY) === "1") return setPush("off");
    if (Notification.permission === "granted") {
      setPush("on");
      const last = Number(localStorage.getItem(PUSH_SYNC_KEY) || 0);
      if (Date.now() - last > 12 * 3600 * 1000) enablePush(false);
    } else if (Notification.permission === "denied") setPush("denied");
    else setPush("off");
  }, [enablePush]);
  useEffect(() => {
    refresh(); // بيانات طازجة فور فتح الصفحة
  }, [refresh]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings.length, open: 0 };
    BOOKING_STATUSES.forEach((s) => (c[s] = 0));
    bookings.forEach((b) => {
      c[b.status] = (c[b.status] || 0) + 1;
      if (b.status === "pending" || b.status === "contacted" || b.status === "confirmed") c.open++;
    });
    return c;
  }, [bookings]);

  const visible = useMemo(() => {
    const q = search.trim();
    return bookings.filter((b) => {
      if (filter === "open" && !["pending", "contacted", "confirmed"].includes(b.status)) return false;
      if (filter !== "all" && filter !== "open" && b.status !== filter) return false;
      if (!q) return true;
      return [b.customer_name, b.customer_phone, localPhone(b.customer_phone), b.district, b.ref].some((v) => (v || "").includes(q));
    });
  }, [bookings, filter, search]);

  const selected = bookings.find((b) => b.id === selectedId) || null;

  function select(id: string) {
    setSelectedId(id);
    setFresh((cur) => {
      const n = new Set(cur);
      n.delete(id);
      return n;
    });
    const u = new URL(location.href);
    if (id) u.searchParams.set("id", id);
    else u.searchParams.delete("id");
    history.replaceState(null, "", u.toString());
  }

  async function patch(id: string, payload: Record<string, unknown>, okMsg = "تم الحفظ") {
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      flash(j.error || "تعذر الحفظ");
      return null;
    }
    setBookings((cur) => cur.map((b) => (b.id === id ? j.booking : b)));
    flash(okMsg);
    return j.booking as Booking;
  }

  async function remove(b: Booking) {
    if (!window.confirm(`حذف الحجز ${b.ref} نهائياً؟ ما يمكن استرجاعه.`)) return;
    const res = await fetch(`/api/admin/bookings/${b.id}`, { method: "DELETE" });
    if (!res.ok) return flash("تعذر الحذف");
    setBookings((cur) => cur.filter((x) => x.id !== b.id));
    select("");
    flash("تم حذف الحجز");
  }

  const tabs: { key: "all" | "open" | BookingStatus; label: string }[] = [
    { key: "open", label: "المفتوحة" },
    { key: "pending", label: "جديدة" },
    { key: "contacted", label: "تم التواصل" },
    { key: "confirmed", label: "مؤكدة" },
    { key: "done", label: "منفذة" },
    { key: "cancelled", label: "ملغية" },
    { key: "all", label: "الكل" },
  ];

  return (
    <div className="bk">
      <style>{CSS}</style>
      <header className="bk-top">
        <nav className="bk-tabs-top" aria-label="أقسام لوحة الإدارة">
          <Link href="/admin/conversations" prefetch>💬 المحادثات</Link>
          <Link href="/admin/bookings" aria-current="page">📅 حجوزات الرش</Link>
        </nav>
        <div className="bk-top-in">
          <div className="bk-brand">
            <b>حجوزات رش المنازل</b>
            <small>الرياض فقط · {counts.pending || 0} حجز جديد بانتظار التواصل</small>
          </div>
          <nav className="bk-nav">
            {push === "unknown" ? null : <button
              type="button"
              className={`bk-push ${push === "on" ? "on" : ""}`}
              onClick={() => enablePush(true)}
              disabled={push === "busy" || push === "unsupported"}
            >
              {push === "on" ? "التنبيهات مفعّلة ✓" : push === "denied" ? "التنبيهات مرفوضة" : push === "unsupported" ? "التنبيهات غير مدعومة" : push === "busy" ? "جاري التفعيل…" : "فعّل التنبيهات"}
            </button>}
          </nav>
        </div>
      </header>

      <main className={`bk-main ${selected ? "has-sel" : ""}`}>
        <section className="bk-list" aria-label="قائمة الحجوزات">
          <div className="bk-tools">
            <input
              type="search"
              placeholder="ابحث بالاسم أو الجوال أو الحي أو رقم الحجز"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" className="bk-ref" onClick={refresh} aria-label="تحديث">↻</button>
          </div>
          <div className="bk-tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={filter === t.key}
                className={filter === t.key ? "on" : ""}
                onClick={() => setFilter(t.key)}
              >
                {t.label} <span>{counts[t.key] || 0}</span>
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="bk-empty">ما فيه حجوزات هنا.</p>
          ) : (
            <ul className="bk-items">
              {visible.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    className={`bk-item ${b.id === selectedId ? "sel" : ""} ${fresh.has(b.id) ? "new" : ""}`}
                    onClick={() => select(b.id)}
                  >
                    <span className="bk-item-top">
                      <b>{b.customer_name}</b>
                      <i className="bk-pill" style={{ background: STATUS_COLORS[b.status] }}>{STATUS_LABELS[b.status]}</i>
                    </span>
                    <span className="bk-item-mid">
                      حي {b.district} · {(b.pests || []).join("، ")}
                    </span>
                    <span className="bk-item-bot">
                      <span>{b.status === "confirmed" && b.confirmed_date ? `الموعد: ${fmtDate(b.confirmed_date)} ${b.confirmed_time || ""}` : `يفضّل: ${fmtDate(b.preferred_date)} · ${b.preferred_period || ""}`}</span>
                      <span>{ago(b.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bk-detail" aria-label="تفاصيل الحجز">
          {selected ? (
            <Detail key={selected.id} b={selected} onBack={() => select("")} onPatch={patch} onDelete={remove} />
          ) : (
            <div className="bk-placeholder">اختر حجز من القائمة عشان تشوف تفاصيله.</div>
          )}
        </section>
      </main>

      {toast ? <div className="bk-toast" role="status">{toast}</div> : null}
    </div>
  );
}

function Detail({
  b,
  onBack,
  onPatch,
  onDelete,
}: {
  b: Booking;
  onBack: () => void;
  onPatch: (id: string, p: Record<string, unknown>, msg?: string) => Promise<Booking | null>;
  onDelete: (b: Booking) => void;
}) {
  const [date, setDate] = useState(b.confirmed_date || b.preferred_date || "");
  const [time, setTime] = useState(b.confirmed_time || "");
  const [price, setPrice] = useState(b.price === null || b.price === undefined ? "" : String(b.price));
  const [note, setNote] = useState(b.admin_note || "");
  const [saving, setSaving] = useState(false);

  const mapUrl = b.lat !== null && b.lng !== null ? `https://www.google.com/maps?q=${b.lat},${b.lng}` : "";

  async function saveConfirm(status?: BookingStatus) {
    setSaving(true);
    const priceNum = price.trim() === "" ? null : Number(price.replace(/[^\d.]/g, ""));
    await onPatch(
      b.id,
      {
        confirmedDate: date,
        confirmedTime: time,
        price: priceNum === null || Number.isNaN(priceNum) ? null : priceNum,
        adminNote: note,
        ...(status ? { status } : {}),
      },
      status === "confirmed" ? "تم تأكيد الحجز ✅" : "تم الحفظ",
    );
    setSaving(false);
  }

  return (
    <article className="bk-card">
      <div className="bk-card-head">
        <button type="button" className="bk-back" onClick={onBack}>→ رجوع</button>
        <span className="bk-refno">رقم الحجز {b.ref}</span>
      </div>
      <h1>{b.customer_name}</h1>
      <p className="bk-sub">
        <i className="bk-pill" style={{ background: STATUS_COLORS[b.status] }}>{STATUS_LABELS[b.status]}</i>
        <span>وصل {new Date(b.created_at).toLocaleString("ar-SA-u-ca-gregory", { dateStyle: "medium", timeStyle: "short" })}</span>
      </p>

      <div className="bk-actions">
        <a className="bk-act call" href={`tel:+${b.customer_phone}`}>اتصال {localPhone(b.customer_phone)}</a>
        <a className="bk-act wa" href={waLink(b, `حياك الله ${b.customer_name}، معك جذرة بخصوص طلب رش المنازل رقم ${b.ref}.`)} target="_blank" rel="noopener">واتساب</a>
        {mapUrl ? <a className="bk-act map" href={mapUrl} target="_blank" rel="noopener">الموقع على الخريطة</a> : <span className="bk-act off">ما شارك موقعه</span>}
      </div>

      <dl className="bk-dl">
        <div><dt>الحي</dt><dd>{b.district}</dd></div>
        {b.address_note ? <div><dt>العنوان</dt><dd>{b.address_note}</dd></div> : null}
        <div><dt>نوع المكان</dt><dd>{b.place_type || "—"}{b.place_size ? ` · ${b.place_size}` : ""}</dd></div>
        <div><dt>الآفة</dt><dd>{(b.pests || []).join("، ")}</dd></div>
        {b.pest_note ? <div><dt>وصف المشكلة</dt><dd>{b.pest_note}</dd></div> : null}
        <div><dt>الموعد المفضّل</dt><dd>{fmtDate(b.preferred_date)} · {b.preferred_period || "—"}</dd></div>
        {b.customer_notes ? <div><dt>ملاحظات العميل</dt><dd>{b.customer_notes}</dd></div> : null}
        {mapUrl && b.location_accuracy ? <div><dt>دقة الموقع</dt><dd>تقريباً {Math.round(b.location_accuracy)} متر</dd></div> : null}
      </dl>

      <h2>تأكيد الموعد والمبلغ</h2>
      <div className="bk-form">
        <label>التاريخ<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>الوقت<input type="text" placeholder="مثال: 4:30 عصراً" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label>المبلغ (ريال)<input type="text" inputMode="decimal" placeholder="مثال: 350" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="wide">ملاحظة داخلية<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="تظهر لك فقط" /></label>
      </div>
      <div className="bk-save">
        <button type="button" className="primary" disabled={saving} onClick={() => saveConfirm("confirmed")}>احفظ وأكّد الحجز</button>
        <button type="button" disabled={saving} onClick={() => saveConfirm()}>احفظ بدون تغيير الحالة</button>
        {b.status === "confirmed" ? (
          <a className="bk-act wa" href={waLink(b, confirmText(b))} target="_blank" rel="noopener">أرسل التأكيد للعميل بالواتساب</a>
        ) : null}
      </div>

      <h2>الحالة</h2>
      <div className="bk-status">
        {BOOKING_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={b.status === s ? "on" : ""}
            style={b.status === s ? { background: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] } : undefined}
            onClick={() => b.status !== s && onPatch(b.id, { status: s }, `الحالة: ${STATUS_LABELS[s]}`)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <button type="button" className="bk-del" onClick={() => onDelete(b)}>حذف الحجز نهائياً</button>
    </article>
  );
}

const CSS = `
.bk{min-height:100vh;background:#f5f8f6;color:#0b2e1f;font-family:"IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;direction:rtl}
.bk *{box-sizing:border-box}
.bk-top{background:#0b2e1f;color:#fff;position:sticky;top:0;z-index:20;padding-top:env(safe-area-inset-top)}
.bk-tabs-top{max-width:1280px;margin:0 auto;padding:10px 18px 0;display:flex;gap:6px}.bk-tabs-top a{text-decoration:none;font-weight:700;font-size:14px;padding:9px 16px;border-radius:12px;color:#d5e4dc;background:#173f2e}.bk-tabs-top a[aria-current=page]{background:#e2b64c;color:#0b2e1f}.bk-tabs-top a:focus-visible{outline:3px solid #e2b64c;outline-offset:2px}
.bk-top-in{max-width:1280px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.bk-brand b{display:block;font-size:18px}.bk-brand small{color:#b9cfc3;font-size:13px}
.bk-nav{display:flex;gap:8px;align-items:center}
.bk-nav a{color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 14px;border-radius:10px;background:#173f2e}
.bk-push{font:inherit;font-weight:700;font-size:14px;border:0;border-radius:10px;padding:10px 14px;background:#e2b64c;color:#0b2e1f;cursor:pointer}
.bk-push.on{background:#2f7d4e;color:#fff}.bk-push:disabled{opacity:.6;cursor:default}
.bk-main{max-width:1280px;margin:0 auto;padding:16px 18px 40px;display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:16px;align-items:start}
.bk-tools{display:flex;gap:8px;margin-bottom:10px}
.bk-tools input{flex:1;font:inherit;font-size:15px;border:1px solid #d6e3db;border-radius:12px;padding:0 14px;min-height:46px;background:#fff;color:#0b2e1f}
.bk-ref{font:inherit;font-size:20px;width:46px;border:1px solid #d6e3db;background:#fff;border-radius:12px;cursor:pointer;color:#0b2e1f}
.bk-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px}
.bk-tabs button{flex:none;font:inherit;font-size:13.5px;font-weight:700;border:1px solid #d6e3db;background:#fff;color:#0b2e1f;border-radius:999px;padding:8px 12px;cursor:pointer;min-height:38px}
.bk-tabs button span{display:inline-block;min-width:22px;padding:0 6px;border-radius:999px;background:#eef5f0;margin-inline-start:4px;font-size:12px}
.bk-tabs button.on{background:#0b2e1f;color:#fff;border-color:#0b2e1f}.bk-tabs button.on span{background:#e2b64c;color:#0b2e1f}
.bk-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.bk-item{width:100%;text-align:right;font:inherit;color:inherit;background:#fff;border:1px solid #e3ece6;border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;cursor:pointer}
.bk-item:hover{border-color:#b9d3c3}.bk-item.sel{border-color:#0b2e1f;box-shadow:0 0 0 2px #0b2e1f inset}
.bk-item.new{border-color:#e2b64c;box-shadow:0 0 0 2px #e2b64c inset}
.bk-item-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.bk-item-top b{font-size:16px}
.bk-item-mid{font-size:14px;color:#3d5a4b}
.bk-item-bot{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:#5f7a6c}
.bk-pill{font-style:normal;color:#fff;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap}
.bk-empty,.bk-placeholder{background:#fff;border:1px dashed #cfe0d6;border-radius:16px;padding:28px;text-align:center;color:#5f7a6c}
.bk-detail{position:sticky;top:130px}
.bk-card{background:#fff;border:1px solid #e3ece6;border-radius:20px;padding:20px}
.bk-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.bk-back{display:none;font:inherit;font-weight:700;border:0;background:#eef5f0;color:#0b2e1f;border-radius:10px;padding:8px 12px;cursor:pointer}
.bk-refno{font-size:13px;color:#5f7a6c;direction:ltr}
.bk-card h1{font-size:24px;margin:0 0 6px}
.bk-card h2{font-size:16px;margin:22px 0 10px;padding-top:16px;border-top:1px solid #eef3f0}
.bk-sub{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px;color:#5f7a6c;font-size:13.5px}
.bk-actions{display:flex;gap:8px;flex-wrap:wrap}
.bk-act{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 16px;border-radius:12px;font-weight:700;font-size:14.5px;text-decoration:none;border:1.5px solid #0b2e1f;color:#0b2e1f;background:#fff}
.bk-act.call{background:#0b2e1f;color:#fff}.bk-act.wa{background:#1f9d55;border-color:#1f9d55;color:#fff}.bk-act.off{border-style:dashed;color:#8a9a92;border-color:#cfe0d6}
.bk-dl{margin:16px 0 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.bk-dl div{background:#f5f8f6;border-radius:12px;padding:10px 12px}
.bk-dl dt{font-size:12.5px;color:#5f7a6c;margin-bottom:2px}.bk-dl dd{margin:0;font-weight:700;font-size:14.5px;line-height:1.6;word-break:break-word}
.bk-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.bk-form label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#3d5a4b}
.bk-form label.wide{grid-column:1/-1}
.bk-form input,.bk-form textarea{font:inherit;font-size:15px;font-weight:500;border:1px solid #d6e3db;border-radius:12px;padding:10px 12px;min-height:46px;color:#0b2e1f;background:#fff}
.bk-save{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.bk-save button{font:inherit;font-weight:700;font-size:14.5px;border-radius:12px;min-height:46px;padding:0 16px;border:1.5px solid #0b2e1f;background:#fff;color:#0b2e1f;cursor:pointer}
.bk-save button.primary{background:#e2b64c;border-color:#e2b64c}
.bk-save button:disabled{opacity:.6}
.bk-status{display:flex;gap:6px;flex-wrap:wrap}
.bk-status button{font:inherit;font-weight:700;font-size:13.5px;border:1.5px solid #d6e3db;background:#fff;color:#0b2e1f;border-radius:999px;padding:8px 14px;min-height:40px;cursor:pointer}
.bk-status button.on{color:#fff}
.bk-del{margin-top:24px;font:inherit;font-size:13.5px;border:0;background:transparent;color:#c53030;text-decoration:underline;cursor:pointer;padding:8px 0}
.bk-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0b2e1f;color:#fff;padding:12px 18px;border-radius:12px;font-weight:700;z-index:50;box-shadow:0 10px 30px rgba(0,0,0,.2)}
.bk a:focus-visible,.bk button:focus-visible,.bk input:focus-visible,.bk textarea:focus-visible{outline:3px solid #e2b64c;outline-offset:2px}
@media (max-width:860px){
 .bk-main{grid-template-columns:minmax(0,1fr)}
 .bk-main.has-sel .bk-list{display:none}
 .bk-main:not(.has-sel) .bk-detail{display:none}
 .bk-detail{position:static}
 .bk-back{display:inline-block}
 .bk-form{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
 .bk-dl{grid-template-columns:minmax(0,1fr)}
 .bk-act{flex:1 1 auto}
}
`;

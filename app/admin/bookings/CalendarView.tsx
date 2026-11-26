"use client";

import { useMemo, useState } from "react";

export type CalBooking = {
  id: string;
  ref: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  district: string;
  address_note: string | null;
  place_type: string | null;
  pests: string[] | null;
  pest_note: string | null;
  customer_notes: string | null;
  admin_note: string | null;
  confirmed_date: string | null;
  confirmed_time: string | null;
  price: number | string | null;
  lat: number | null;
  lng: number | null;
};

const WEEK = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function riyadhTodayYmd() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** "16:30" ← يعرض "4:30 م"؛ أي نص قديم غير منسق يُعرض كما هو */
export function fmtTime(t?: string | null) {
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return t;
  let h = Number(m[1]);
  const ampm = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}
function timeKey(t?: string | null) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
}

function reminderText(b: CalBooking) {
  const day = b.confirmed_date
    ? new Date(b.confirmed_date + "T12:00:00").toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long" })
    : "";
  return [
    `حياك الله ${b.customer_name}، معك جذرة 🌿`,
    `نذكرك بموعد رش المنازل يوم ${day}${b.confirmed_time ? ` الساعة ${fmtTime(b.confirmed_time)}` : ""} في حي ${b.district}.`,
    "قبل الموعد: غطِّ الأكل وأواني المطبخ، وأبعد الأطفال والحيوانات الأليفة عن المكان.",
    `رقم الحجز: ${b.ref}`,
  ].join("\n");
}

export default function CalendarView({
  bookings,
  onOpen,
}: {
  bookings: CalBooking[];
  onOpen: (id: string) => void;
}) {
  const today = riyadhTodayYmd();
  const [cursor, setCursor] = useState(() => {
    const d = new Date(today + "T12:00:00");
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [day, setDay] = useState(today);

  const byDay = useMemo(() => {
    const map = new Map<string, CalBooking[]>();
    for (const b of bookings) {
      if (!b.confirmed_date || !["confirmed", "done"].includes(b.status)) continue;
      const arr = map.get(b.confirmed_date) || [];
      arr.push(b);
      map.set(b.confirmed_date, arr);
    }
    for (const arr of map.values()) arr.sort((a, c) => timeKey(a.confirmed_time) - timeKey(c.confirmed_time));
    return map;
  }, [bookings]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 1) % 7; // السبت أول الأسبوع
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const monthCount = useMemo(() => {
    const prefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    let n = 0;
    for (const [k, v] of byDay) if (k.startsWith(prefix)) n += v.filter((b) => b.status === "confirmed").length;
    return n;
  }, [byDay, cursor]);

  const dayList = byDay.get(day) || [];
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <section className="cal" aria-label="تقويم الحجوزات المؤكدة">
      <div className="cal-head">
        <button type="button" onClick={() => shift(-1)} aria-label="الشهر السابق">›</button>
        <div className="cal-title">
          <b>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</b>
          <small>{monthCount} موعد مؤكد هذا الشهر</small>
        </div>
        <button type="button" onClick={() => shift(1)} aria-label="الشهر التالي">‹</button>
        <button
          type="button"
          className="cal-today"
          onClick={() => {
            const d = new Date(today + "T12:00:00");
            setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            setDay(today);
          }}
        >
          اليوم
        </button>
      </div>

      <div className="cal-grid" role="grid">
        {WEEK.map((w) => (
          <div key={w} className="cal-wd" role="columnheader">{w}</div>
        ))}
        {cells.map((d) => {
          const k = ymd(d);
          const list = byDay.get(k) || [];
          const out = d.getMonth() !== cursor.getMonth();
          return (
            <button
              key={k}
              type="button"
              role="gridcell"
              aria-selected={k === day}
              aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]}${list.length ? `، ${list.length} موعد` : ""}`}
              className={`cal-cell ${out ? "out" : ""} ${k === today ? "today" : ""} ${k === day ? "sel" : ""} ${list.length ? "has" : ""}`}
              onClick={() => setDay(k)}
            >
              <span className="cal-n">{d.getDate()}</span>
              {list.slice(0, 2).map((b) => (
                <span key={b.id} className={`cal-chip ${b.status === "done" ? "done" : ""}`}>
                  {b.confirmed_time ? fmtTime(b.confirmed_time) + " " : ""}{b.district}
                </span>
              ))}
              {list.length > 2 ? <span className="cal-more">+{list.length - 2}</span> : null}
              {list.length ? <span className="cal-dot" aria-hidden="true">{list.length}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="cal-day">
        <h2>
          {new Date(day + "T12:00:00").toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long" })}
          <span>{dayList.length ? `${dayList.length} موعد` : "ما فيه مواعيد"}</span>
        </h2>
        {dayList.map((b) => (
          <article key={b.id} className={`cal-card ${b.status === "done" ? "done" : ""}`}>
            <div className="cal-time">{b.confirmed_time ? fmtTime(b.confirmed_time) : "بدون وقت"}</div>
            <div className="cal-body">
              <b>{b.customer_name}</b>
              <span>حي {b.district}{b.place_type ? ` · ${b.place_type}` : ""}{b.price !== null && b.price !== "" ? ` · ${b.price} ريال` : ""}</span>
              <span className="cal-pests">{(b.pests || []).join("، ")}</span>
              {b.customer_notes ? <p className="cal-note"><em>ملاحظة العميل:</em> {b.customer_notes}</p> : null}
              {b.pest_note ? <p className="cal-note"><em>المشكلة:</em> {b.pest_note}</p> : null}
              {b.admin_note ? <p className="cal-note mine"><em>ملاحظتك:</em> {b.admin_note}</p> : null}
              <div className="cal-acts">
                <a href={`tel:+${b.customer_phone}`}>اتصال</a>
                <a className="wa" href={`https://wa.me/${b.customer_phone}?text=${encodeURIComponent(reminderText(b))}`} target="_blank" rel="noopener">ذكّر العميل</a>
                {b.lat !== null && b.lng !== null ? <a href={`https://www.google.com/maps?q=${b.lat},${b.lng}`} target="_blank" rel="noopener">الخريطة</a> : null}
                <button type="button" onClick={() => onOpen(b.id)}>التفاصيل</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export const CAL_CSS = `
.cal{max-width:1280px;margin:0 auto;padding:16px 18px 40px}
.cal-head{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.cal-head>button{font:inherit;font-size:22px;font-weight:700;width:44px;height:44px;border-radius:12px;border:1px solid #d6e3db;background:#fff;color:#0b2e1f;cursor:pointer}
.cal-head .cal-today{width:auto;padding:0 14px;font-size:14px;margin-inline-start:auto}
.cal-title b{display:block;font-size:18px}.cal-title small{color:#5f7a6c;font-size:13px}
.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;background:#fff;border:1px solid #e3ece6;border-radius:18px;padding:8px}
.cal-wd{text-align:center;font-size:12.5px;font-weight:700;color:#5f7a6c;padding:4px 0}
.cal-cell{position:relative;font:inherit;text-align:right;min-height:92px;border:1px solid #eef3f0;background:#fbfdfc;border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:3px;cursor:pointer;color:#0b2e1f;overflow:hidden}
.cal-cell.out{opacity:.4}
.cal-cell.today .cal-n{background:#e2b64c;color:#0b2e1f;border-radius:999px;padding:0 7px}
.cal-cell.sel{border-color:#0b2e1f;box-shadow:0 0 0 2px #0b2e1f inset}
.cal-cell.has{background:#fff}
.cal-n{font-weight:800;font-size:13.5px;align-self:flex-start}
.cal-chip{display:block;font-size:11.5px;font-weight:700;background:#0b2e1f;color:#fff;border-radius:7px;padding:2px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cal-chip.done{background:#cfd8d3;color:#3d5a4b}
.cal-more{font-size:11.5px;color:#5f7a6c;font-weight:700}
.cal-dot{display:none}
.cal-day{margin-top:16px}
.cal-day h2{font-size:17px;margin:0 0 10px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.cal-day h2 span{font-size:13px;color:#5f7a6c;font-weight:500}
.cal-card{display:flex;gap:12px;background:#fff;border:1px solid #e3ece6;border-radius:16px;padding:12px;margin-bottom:8px}
.cal-card.done{opacity:.7}
.cal-time{flex:none;min-width:70px;text-align:center;background:#0b2e1f;color:#e2b64c;border-radius:12px;padding:10px 6px;font-weight:800;font-size:15px;align-self:flex-start}
.cal-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.cal-body b{font-size:16px}.cal-body span{font-size:13.5px;color:#3d5a4b}
.cal-pests{font-weight:700}
.cal-note{margin:4px 0 0;background:#f5f8f6;border-radius:10px;padding:8px 10px;font-size:13.5px;line-height:1.6}
.cal-note em{font-style:normal;font-weight:700;color:#5f7a6c}.cal-note.mine{background:#fff7e3}
.cal-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.cal-acts a,.cal-acts button{font:inherit;font-size:13.5px;font-weight:700;text-decoration:none;border:1.5px solid #0b2e1f;color:#0b2e1f;background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;min-height:40px;display:inline-flex;align-items:center}
.cal-acts a.wa{background:#1f9d55;border-color:#1f9d55;color:#fff}
.cal-cell:focus-visible,.cal-acts a:focus-visible,.cal-acts button:focus-visible,.cal-head button:focus-visible{outline:3px solid #e2b64c;outline-offset:2px}
@media (max-width:700px){
 .cal{padding:12px 10px 30px}
 .cal-grid{gap:2px;padding:6px;border-radius:14px}
 .cal-cell{min-height:52px;padding:4px;align-items:center;border-radius:10px}
 .cal-n{align-self:center}
 .cal-chip,.cal-more{display:none}
 .cal-dot{display:grid;place-items:center;min-width:20px;height:20px;border-radius:999px;background:#0b2e1f;color:#e2b64c;font-size:11.5px;font-weight:800;padding:0 5px}
}
`;

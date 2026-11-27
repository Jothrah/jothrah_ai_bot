"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EXPENSE_CATEGORIES, PAYMENT_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/finance";

type FinBooking = {
  id: string;
  ref: string;
  customer_name: string;
  district: string;
  place_type: string | null;
  status: "confirmed" | "done";
  confirmed_date: string | null;
  updated_at: string;
  price: number | string | null;
  payment_status: "unpaid" | "paid" | null;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
};

type Expense = {
  id: string;
  spent_on: string;
  category: string;
  amount: number | string;
  note: string | null;
  booking_id: string | null;
  created_at: string;
};

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function riyadhToday() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}
function num(v: number | string | null | undefined) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function hasPrice(b: FinBooking) {
  return b.price !== null && b.price !== undefined && String(b.price) !== "";
}
function money(n: number) {
  return n.toLocaleString("ar-SA-u-nu-latn", { maximumFractionDigits: 2 }) + " ريال";
}
/** تاريخ الحجز المالي: تاريخ الموعد المؤكد، وإلا تاريخ آخر تحديث */
function bookingDate(b: FinBooking) {
  if (b.confirmed_date) return b.confirmed_date;
  return new Date(new Date(b.updated_at).getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}
function fmtDay(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

type Period = { mode: "month" | "year"; y: number; m: number };
function inPeriod(d: string, p: Period) {
  const [y, m] = d.split("-").map(Number);
  return p.mode === "year" ? y === p.y : y === p.y && m === p.m;
}
function periodLabel(p: Period) {
  return p.mode === "year" ? `سنة ${p.y}` : `${MONTHS[p.m - 1]} ${p.y}`;
}

function csvCell(v: string | number) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function FinanceClient({
  initialBookings,
  initialExpenses,
  loadError,
}: {
  initialBookings: FinBooking[];
  initialExpenses: Expense[];
  loadError: string;
}) {
  const today = riyadhToday();
  const [bookings, setBookings] = useState<FinBooking[]>(initialBookings);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [period, setPeriod] = useState<Period>({ mode: "month", y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [tab, setTab] = useState<"income" | "expenses" | "reports">("income");
  const [toast, setToast] = useState(loadError);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    document.cookie = "jothrah_admin_last=finance; path=/; max-age=31536000; samesite=lax";
    try {
      const t = localStorage.getItem("jothrah_fin_tab");
      if (t === "income" || t === "expenses" || t === "reports") setTab(t);
    } catch {}
  }, []);
  const switchTab = (t: typeof tab) => {
    setTab(t);
    try { localStorage.setItem("jothrah_fin_tab", t); } catch {}
  };

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/finance", { cache: "no-store" });
      if (res.status === 401) {
        location.href = "/admin/login?next=/admin/finance";
        return;
      }
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setBookings(j.bookings);
      setExpenses(j.expenses);
    } catch {
      flash("تعذر التحديث، تأكد من الاتصال");
    }
  }, [flash]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const shift = (dir: number) => {
    setPeriod((p) => {
      if (p.mode === "year") return { ...p, y: p.y + dir };
      let m = p.m + dir;
      let y = p.y;
      if (m < 1) { m = 12; y -= 1; }
      if (m > 12) { m = 1; y += 1; }
      return { ...p, y, m };
    });
  };

  /* ===== الحسابات ===== */
  const doneInPeriod = useMemo(
    () => bookings.filter((b) => b.status === "done" && inPeriod(bookingDate(b), period)).sort((a, b) => bookingDate(b).localeCompare(bookingDate(a))),
    [bookings, period]
  );
  const upcoming = useMemo(
    () => bookings.filter((b) => b.status === "confirmed" && inPeriod(bookingDate(b), period)),
    [bookings, period]
  );
  const expInPeriod = useMemo(
    () => expenses.filter((e) => inPeriod(e.spent_on, period)).sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at)),
    [expenses, period]
  );

  const totals = useMemo(() => {
    let collected = 0, due = 0, noPrice = 0;
    for (const b of doneInPeriod) {
      if (!hasPrice(b)) { noPrice++; continue; }
      if (b.payment_status === "paid") collected += num(b.price);
      else due += num(b.price);
    }
    const expected = upcoming.reduce((s, b) => s + (hasPrice(b) ? num(b.price) : 0), 0);
    const spent = expInPeriod.reduce((s, e) => s + num(e.amount), 0);
    return { collected, due, noPrice, expected, spent, net: collected - spent };
  }, [doneInPeriod, upcoming, expInPeriod]);

  /* ===== الدفع ===== */
  const setPayment = async (b: FinBooking, status: "paid" | "unpaid", method?: PaymentMethod | "") => {
    setBusy(b.id);
    try {
      const body: Record<string, unknown> = { paymentStatus: status };
      if (method !== undefined) body.paymentMethod = method;
      const res = await fetch(`/api/admin/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setBookings((all) => all.map((x) => (x.id === b.id ? { ...x, ...j.booking } : x)));
      flash(status === "paid" ? "تم تسجيل الدفع ✅" : "رجع الحجز إلى غير مدفوع");
    } catch {
      flash("تعذر حفظ حالة الدفع");
    } finally {
      setBusy("");
    }
  };

  /* ===== المصاريف ===== */
  const [fDate, setFDate] = useState(today);
  const [fCat, setFCat] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [fAmount, setFAmount] = useState("");
  const [fNote, setFNote] = useState("");
  const [fBooking, setFBooking] = useState("");

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(fAmount.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^\d.]/g, ""));
    if (!amount || amount <= 0) { flash("اكتب مبلغ المصروف"); return; }
    setBusy("add");
    try {
      const res = await fetch("/api/admin/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spentOn: fDate, category: fCat, amount, note: fNote, bookingId: fBooking }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setExpenses((all) => [j.expense, ...all]);
      setFAmount("");
      setFNote("");
      setFBooking("");
      flash("تمت إضافة المصروف ✅");
    } catch (err) {
      flash(err instanceof Error && err.message ? err.message : "تعذر حفظ المصروف");
    } finally {
      setBusy("");
    }
  };

  const delExpense = async (x: Expense) => {
    if (!window.confirm(`حذف مصروف ${x.category} بمبلغ ${money(num(x.amount))}؟`)) return;
    setBusy(x.id);
    try {
      const res = await fetch(`/api/admin/finance/expenses/${x.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setExpenses((all) => all.filter((e) => e.id !== x.id));
      flash("تم حذف المصروف");
    } catch {
      flash("تعذر حذف المصروف");
    } finally {
      setBusy("");
    }
  };

  const bookingById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);
  const linkable = useMemo(
    () => bookings.filter((b) => inPeriod(bookingDate(b), period) || bookingDate(b) >= today).slice(0, 80),
    [bookings, period, today]
  );

  /* ===== التقارير ===== */
  const months6 = useMemo(() => {
    const out: { label: string; income: number; spent: number }[] = [];
    const base = period.mode === "month" ? { y: period.y, m: period.m } : { y: period.y, m: 12 };
    for (let i = 5; i >= 0; i--) {
      let m = base.m - i, y = base.y;
      while (m < 1) { m += 12; y -= 1; }
      const p: Period = { mode: "month", y, m };
      const income = bookings
        .filter((b) => b.status === "done" && b.payment_status === "paid" && inPeriod(bookingDate(b), p))
        .reduce((s, b) => s + num(b.price), 0);
      const spent = expenses.filter((e) => inPeriod(e.spent_on, p)).reduce((s, e) => s + num(e.amount), 0);
      out.push({ label: MONTHS[m - 1], income, spent });
    }
    return out;
  }, [bookings, expenses, period]);
  const maxBar = Math.max(1, ...months6.map((x) => Math.max(x.income, x.spent)));

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expInPeriod) map.set(e.category, (map.get(e.category) || 0) + num(e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expInPeriod]);
  const maxCat = Math.max(1, ...byCategory.map((x) => x[1]));

  const exportCsv = () => {
    const rows: (string | number)[][] = [["النوع", "التاريخ", "البيان", "التصنيف / الحي", "المبلغ (ريال)", "حالة الدفع", "طريقة الدفع", "رقم الحجز"]];
    for (const b of doneInPeriod) {
      rows.push([
        "دخل",
        bookingDate(b),
        b.customer_name,
        b.district,
        hasPrice(b) ? num(b.price) : "",
        b.payment_status === "paid" ? "مدفوع" : "غير مدفوع",
        b.payment_method ? PAYMENT_LABELS[b.payment_method] : "",
        b.ref,
      ]);
    }
    for (const e of expInPeriod) {
      const lb = e.booking_id ? bookingById.get(e.booking_id) : null;
      rows.push(["مصروف", e.spent_on, e.note || "", e.category, -num(e.amount), "", "", lb ? lb.ref : ""]);
    }
    rows.push([]);
    rows.push(["الدخل المحصّل", "", "", "", totals.collected]);
    rows.push(["مستحق لم يُحصّل", "", "", "", totals.due]);
    rows.push(["المصاريف", "", "", "", -totals.spent]);
    rows.push(["صافي الربح", "", "", "", totals.net]);
    const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jothrah-finance-${period.mode === "year" ? period.y : `${period.y}-${String(period.m).padStart(2, "0")}`}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="fn">
      <style>{CSS}</style>
      <header className="fn-top">
        <nav className="fn-tabs-top" aria-label="أقسام لوحة الإدارة">
          <Link href="/admin/conversations" prefetch>💬 محادثات</Link>
          <Link href="/admin/bookings" prefetch>📅 حجوزات</Link>
          <Link href="/admin/finance" aria-current="page">💰 المالية</Link>
          <a href="/admin/watermark">🖼️ الصور</a>
        </nav>
        <div className="fn-top-in">
          <div className="fn-logo" aria-hidden="true">ج</div>
          <div className="fn-brand">
            <b>الإدارة المالية</b>
            <small>دخل ومصاريف رش المنازل</small>
          </div>
          <div className="fn-icons">
            <button type="button" className="fn-ic" onClick={exportCsv} title="تصدير Excel" aria-label="تصدير Excel">⬇️</button>
            <button type="button" className="fn-ic" onClick={refresh} title="تحديث" aria-label="تحديث">⟳</button>
          </div>
        </div>
      </header>

      <main className="fn-main">
        <div className="fn-period">
          <div className="fn-nav">
            <button type="button" onClick={() => shift(-1)} aria-label="الفترة السابقة">›</button>
            <b>{periodLabel(period)}</b>
            <button type="button" onClick={() => shift(1)} aria-label="الفترة التالية">‹</button>
          </div>
          <div className="fn-mode" role="group" aria-label="نوع الفترة">
            <button type="button" className={period.mode === "month" ? "on" : ""} onClick={() => setPeriod((p) => ({ ...p, mode: "month" }))}>شهري</button>
            <button type="button" className={period.mode === "year" ? "on" : ""} onClick={() => setPeriod((p) => ({ ...p, mode: "year" }))}>سنوي</button>
          </div>
        </div>

        <section className="fn-kpis" aria-label="ملخص الفترة">
          <div className="fn-kpi good"><small>الدخل المحصّل</small><b>{money(totals.collected)}</b></div>
          <div className="fn-kpi warn"><small>مستحق لم يُحصّل</small><b>{money(totals.due)}</b></div>
          <div className="fn-kpi bad"><small>المصاريف</small><b>{money(totals.spent)}</b></div>
          <div className={`fn-kpi net ${totals.net < 0 ? "neg" : ""}`}><small>صافي الربح</small><b>{money(totals.net)}</b></div>
        </section>
        {totals.expected > 0 || totals.noPrice > 0 ? (
          <p className="fn-hint">
            {totals.expected > 0 ? `مواعيد مؤكدة لم تُنفذ بعد في هذه الفترة بقيمة ${money(totals.expected)}. ` : ""}
            {totals.noPrice > 0 ? `${totals.noPrice} حجز منفذ بدون مبلغ، أضف المبلغ من صفحة الحجوزات.` : ""}
          </p>
        ) : null}

        <div className="fn-subtabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "income"} className={tab === "income" ? "on" : ""} onClick={() => switchTab("income")}>الدخل <span>{doneInPeriod.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === "expenses"} className={tab === "expenses" ? "on" : ""} onClick={() => switchTab("expenses")}>المصاريف <span>{expInPeriod.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === "reports"} className={tab === "reports" ? "on" : ""} onClick={() => switchTab("reports")}>التقارير</button>
        </div>

        {tab === "income" ? (
          <section className="fn-list">
            {doneInPeriod.length === 0 ? (
              <div className="fn-empty">لا توجد حجوزات منفذة في {periodLabel(period)}. لما تغيّر حالة الحجز إلى «تم التنفيذ» يظهر هنا.</div>
            ) : (
              doneInPeriod.map((b) => {
                const paid = b.payment_status === "paid";
                return (
                  <article key={b.id} className={`fn-row ${paid ? "paid" : ""}`}>
                    <div className="fn-row-main">
                      <div className="fn-row-hd">
                        <b>{b.customer_name}</b>
                        <span className="fn-amt">{hasPrice(b) ? money(num(b.price)) : "بدون مبلغ"}</span>
                      </div>
                      <small>{fmtDay(bookingDate(b))} · حي {b.district}{b.place_type ? ` · ${b.place_type}` : ""} · {b.ref}</small>
                    </div>
                    <div className="fn-pay">
                      <div className="fn-methods" role="group" aria-label="طريقة الدفع">
                        {PAYMENT_METHODS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={b.payment_method === m ? "on" : ""}
                            disabled={busy === b.id}
                            onClick={() => setPayment(b, "paid", m)}
                          >
                            {PAYMENT_LABELS[m]}
                          </button>
                        ))}
                      </div>
                      {paid ? (
                        <button type="button" className="fn-paid" disabled={busy === b.id} onClick={() => setPayment(b, "unpaid", "")} title="إلغاء تسجيل الدفع">
                          ✅ مدفوع
                        </button>
                      ) : (
                        <span className="fn-unpaid">لم يُدفع</span>
                      )}
                    </div>
                    <Link className="fn-open" href={`/admin/bookings?id=${b.id}`} prefetch={false}>فتح الحجز</Link>
                  </article>
                );
              })
            )}
          </section>
        ) : null}

        {tab === "expenses" ? (
          <section className="fn-exp">
            <form className="fn-form" onSubmit={addExpense}>
              <b className="fn-form-title">إضافة مصروف</b>
              <div className="fn-cats" role="group" aria-label="التصنيف">
                {EXPENSE_CATEGORIES.map((c) => (
                  <button key={c} type="button" className={fCat === c ? "on" : ""} onClick={() => setFCat(c)}>{c}</button>
                ))}
              </div>
              <div className="fn-grid">
                <label>المبلغ (ريال)<input type="text" inputMode="decimal" placeholder="مثال: 120" value={fAmount} onChange={(e) => setFAmount(e.target.value)} required /></label>
                <label>التاريخ<input type="date" value={fDate} max={today} onChange={(e) => setFDate(e.target.value)} required /></label>
              </div>
              <label>ملاحظة<input type="text" placeholder="مثال: عبوتين مبيد صراصير" value={fNote} maxLength={500} onChange={(e) => setFNote(e.target.value)} /></label>
              <label>
                ربطه بحجز (اختياري)
                <select value={fBooking} onChange={(e) => setFBooking(e.target.value)}>
                  <option value="">بدون ربط</option>
                  {linkable.map((b) => (
                    <option key={b.id} value={b.id}>{b.customer_name} · {fmtDay(bookingDate(b))}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="fn-save" disabled={busy === "add"}>{busy === "add" ? "جاري الحفظ…" : "حفظ المصروف"}</button>
            </form>

            <div className="fn-list">
              {expInPeriod.length === 0 ? (
                <div className="fn-empty">لا توجد مصاريف مسجلة في {periodLabel(period)}.</div>
              ) : (
                expInPeriod.map((x) => {
                  const lb = x.booking_id ? bookingById.get(x.booking_id) : null;
                  return (
                    <article key={x.id} className="fn-row">
                      <div className="fn-row-main">
                        <div className="fn-row-hd">
                          <b>{x.category}</b>
                          <span className="fn-amt neg">{money(num(x.amount))}</span>
                        </div>
                        <small>{fmtDay(x.spent_on)}{x.note ? ` · ${x.note}` : ""}{lb ? ` · حجز ${lb.customer_name}` : ""}</small>
                      </div>
                      <button type="button" className="fn-del" disabled={busy === x.id} onClick={() => delExpense(x)} aria-label="حذف المصروف">حذف</button>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ) : null}

        {tab === "reports" ? (
          <section className="fn-reports">
            <div className="fn-card">
              <div className="fn-card-hd">
                <b>آخر 6 أشهر</b>
                <span className="fn-legend"><i className="in" /> دخل محصّل <i className="out" /> مصاريف</span>
              </div>
              <div className="fn-bars">
                {months6.map((x) => (
                  <div key={x.label} className="fn-bar-col" title={`${x.label}: دخل ${money(x.income)} · مصاريف ${money(x.spent)}`}>
                    <div className="fn-bar-pair">
                      <span className="in" style={{ height: `${(x.income / maxBar) * 100}%` }} />
                      <span className="out" style={{ height: `${(x.spent / maxBar) * 100}%` }} />
                    </div>
                    <small>{x.label}</small>
                  </div>
                ))}
              </div>
              <table className="fn-table">
                <thead><tr><th>الشهر</th><th>الدخل</th><th>المصاريف</th><th>الصافي</th></tr></thead>
                <tbody>
                  {months6.map((x) => (
                    <tr key={x.label}><td>{x.label}</td><td>{money(x.income)}</td><td>{money(x.spent)}</td><td className={x.income - x.spent < 0 ? "neg" : ""}>{money(x.income - x.spent)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="fn-card">
              <div className="fn-card-hd"><b>المصاريف حسب التصنيف · {periodLabel(period)}</b></div>
              {byCategory.length === 0 ? (
                <p className="fn-muted">لا توجد مصاريف في هذه الفترة.</p>
              ) : (
                byCategory.map(([c, v]) => (
                  <div key={c} className="fn-hbar">
                    <span className="lbl">{c}</span>
                    <span className="track"><span style={{ width: `${(v / maxCat) * 100}%` }} /></span>
                    <span className="val">{money(v)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="fn-card">
              <div className="fn-card-hd"><b>تصدير</b></div>
              <p className="fn-muted">ملف يفتح في Excel فيه دخل ومصاريف {periodLabel(period)} مع الإجماليات.</p>
              <button type="button" className="fn-save" onClick={exportCsv}>⬇️ تصدير {periodLabel(period)}</button>
            </div>

            <div className="fn-card soon">
              <div className="fn-card-hd"><b>مبيعات متجر سلة</b></div>
              <p className="fn-muted">تظهر هنا بعد ربط حساب المتجر بتطبيق خاص في منصة شركاء سلة.</p>
            </div>
          </section>
        ) : null}
      </main>

      {toast ? <div className="fn-toast" role="status">{toast}</div> : null}
    </div>
  );
}

const CSS = `
html,body{background:#0b2e1f}
.fn{min-height:100vh;background:#f5f8f6;color:#0b2e1f;font-family:"IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;direction:rtl}
.fn *{box-sizing:border-box}
.fn-top{background:#0b2e1f;color:#fff;position:sticky;top:0;z-index:20;padding-top:env(safe-area-inset-top)}
.fn-tabs-top{max-width:1280px;margin:0 auto;padding:12px 16px 0;display:flex;gap:6px}.fn-tabs-top a{flex:1;text-align:center;text-decoration:none;font-weight:700;font-size:14px;padding:10px 6px;border-radius:12px;color:#d5e4dc;background:#173f2e;white-space:nowrap}.fn-tabs-top a[aria-current=page]{background:#e2b64c;color:#0b2e1f}.fn-tabs-top a:focus-visible{outline:3px solid #e2b64c;outline-offset:2px}
.fn-top-in{max-width:1280px;margin:0 auto;padding:14px 16px 16px;display:flex;align-items:center;gap:11px}
.fn-logo{width:42px;height:42px;border-radius:14px;background:#e2b64c;color:#0b2e1f;display:grid;place-items:center;font-weight:800;font-size:20px;flex:none}
.fn-brand{flex:1;min-width:0}.fn-brand b{display:block;font-size:17px}.fn-brand small{color:#b9cfc3;font-size:13px}
.fn-icons{display:flex;gap:6px}
.fn-ic{width:38px;height:38px;border-radius:12px;border:1px solid #2a5a44;background:#173f2e;color:#fff;display:grid;place-items:center;font-size:16px;cursor:pointer;padding:0}
.fn-ic:focus-visible{outline:3px solid #fff;outline-offset:2px}
.fn-main{max-width:1080px;margin:0 auto;padding:16px 16px 48px}
.fn-period{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.fn-nav{display:flex;align-items:center;gap:8px}.fn-nav b{font-size:18px;min-width:120px;text-align:center}
.fn-nav button{width:40px;height:40px;border-radius:12px;border:1px solid #d6e3db;background:#fff;color:#0b2e1f;font-size:22px;cursor:pointer;line-height:1}
.fn-mode{display:flex;background:#fff;border:1px solid #d6e3db;border-radius:12px;padding:3px}
.fn-mode button{font:inherit;font-weight:700;font-size:13.5px;border:0;background:none;color:#5f7a6c;padding:8px 14px;border-radius:9px;cursor:pointer}
.fn-mode button.on{background:#0b2e1f;color:#fff}
.fn-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.fn-kpi{background:#fff;border:1px solid #e3ece6;border-radius:16px;padding:14px;border-top:4px solid #e3ece6}
.fn-kpi small{display:block;color:#5f7a6c;font-size:13px;font-weight:600}
.fn-kpi b{display:block;font-size:20px;margin-top:6px;font-variant-numeric:tabular-nums}
.fn-kpi.good{border-top-color:#2f7d4e}.fn-kpi.warn{border-top-color:#e2b64c}.fn-kpi.bad{border-top-color:#b4452f}
.fn-kpi.net{background:#0b2e1f;border-color:#0b2e1f;color:#fff;border-top-color:#e2b64c}.fn-kpi.net small{color:#b9cfc3}.fn-kpi.net.neg b{color:#ffb4a3}
.fn-hint{margin:10px 2px 0;color:#5f7a6c;font-size:13.5px;line-height:1.7}
.fn-subtabs{display:flex;gap:6px;margin:16px 0 12px}
.fn-subtabs button{flex:1;font:inherit;font-weight:700;font-size:14px;border:1px solid #d6e3db;background:#fff;color:#0b2e1f;border-radius:12px;padding:10px 8px;cursor:pointer;min-height:44px}
.fn-subtabs button span{display:inline-block;min-width:22px;padding:0 6px;border-radius:999px;background:#eef5f0;margin-inline-start:4px;font-size:12px}
.fn-subtabs button.on{background:#0b2e1f;color:#fff;border-color:#0b2e1f}.fn-subtabs button.on span{background:#e2b64c;color:#0b2e1f}
.fn-list{display:flex;flex-direction:column;gap:8px}
.fn-empty{background:#fff;border:1px dashed #cfdcd4;border-radius:16px;padding:22px;text-align:center;color:#5f7a6c;line-height:1.8}
.fn-row{background:#fff;border:1px solid #e3ece6;border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-inline-start:4px solid #e2b64c}
.fn-row.paid{border-inline-start-color:#2f7d4e}
.fn-exp .fn-row{border-inline-start-color:#b4452f}
.fn-row-main{flex:1;min-width:200px}
.fn-row-hd{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.fn-row-hd b{font-size:15.5px}
.fn-row small{display:block;color:#5f7a6c;font-size:13px;margin-top:3px;line-height:1.6}
.fn-amt{font-weight:800;font-size:15.5px;white-space:nowrap;font-variant-numeric:tabular-nums}.fn-amt.neg{color:#b4452f}
.fn-pay{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fn-methods{display:flex;gap:4px}
.fn-methods button{font:inherit;font-size:13px;font-weight:700;border:1px solid #d6e3db;background:#fff;color:#0b2e1f;border-radius:10px;padding:7px 11px;cursor:pointer;min-height:36px}
.fn-methods button.on{background:#e8f3ec;border-color:#2f7d4e;color:#1f5e38}
.fn-methods button:disabled,.fn-paid:disabled,.fn-del:disabled{opacity:.55;cursor:default}
.fn-paid{font:inherit;font-size:13px;font-weight:700;border:0;background:#2f7d4e;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;min-height:36px}
.fn-unpaid{font-size:13px;font-weight:700;color:#8a5a00;background:#fff4d6;border-radius:10px;padding:8px 12px}
.fn-open{font-size:13px;font-weight:700;color:#0b2e1f;text-decoration:underline;text-underline-offset:3px}
.fn-del{font:inherit;font-size:13px;font-weight:700;border:1px solid #f0cfc7;background:#fff;color:#b4452f;border-radius:10px;padding:8px 12px;cursor:pointer;min-height:36px}
.fn-exp{display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:14px;align-items:start}
.fn-form{background:#fff;border:1px solid #e3ece6;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;position:sticky;top:150px}
.fn-form-title{font-size:16px}
.fn-form label{display:flex;flex-direction:column;gap:5px;font-size:13.5px;font-weight:700;color:#173f2e}
.fn-form input,.fn-form select{font:inherit;font-size:16px;font-weight:400;border:1px solid #d6e3db;border-radius:12px;padding:0 12px;min-height:46px;background:#fff;color:#0b2e1f;width:100%}
.fn-form input:focus,.fn-form select:focus{outline:3px solid #e2b64c;outline-offset:0;border-color:#0b2e1f}
.fn-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.fn-cats{display:flex;flex-wrap:wrap;gap:6px}
.fn-cats button{font:inherit;font-size:13px;font-weight:700;border:1px solid #d6e3db;background:#fff;color:#0b2e1f;border-radius:999px;padding:7px 12px;cursor:pointer;min-height:36px}
.fn-cats button.on{background:#0b2e1f;color:#fff;border-color:#0b2e1f}
.fn-save{font:inherit;font-weight:800;font-size:15px;border:0;background:#e2b64c;color:#0b2e1f;border-radius:12px;min-height:48px;cursor:pointer;padding:0 16px}
.fn-save:disabled{opacity:.6}
.fn-save:focus-visible,.fn-methods button:focus-visible,.fn-cats button:focus-visible,.fn-subtabs button:focus-visible,.fn-mode button:focus-visible,.fn-nav button:focus-visible{outline:3px solid #e2b64c;outline-offset:2px}
.fn-reports{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fn-card{background:#fff;border:1px solid #e3ece6;border-radius:16px;padding:14px}
.fn-card:first-child{grid-column:1/-1}
.fn-card.soon{background:#f9fbfa;border-style:dashed}
.fn-card-hd{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}.fn-card-hd b{font-size:15.5px}
.fn-legend{font-size:12.5px;color:#5f7a6c;display:flex;align-items:center;gap:5px}
.fn-legend i{display:inline-block;width:10px;height:10px;border-radius:3px}.fn-legend i.in,.fn-bar-pair .in{background:#2f7d4e}.fn-legend i.out,.fn-bar-pair .out{background:#e2b64c}
.fn-legend i.out{margin-inline-start:8px}
.fn-bars{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;height:170px;align-items:end;margin-bottom:12px}
.fn-bar-col{display:flex;flex-direction:column;align-items:center;gap:6px;height:100%}
.fn-bar-pair{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:4px;border-bottom:1px solid #e3ece6}
.fn-bar-pair span{width:38%;max-width:26px;border-radius:6px 6px 0 0;min-height:2px}
.fn-bar-col small{font-size:12px;color:#5f7a6c}
.fn-table{width:100%;border-collapse:collapse;font-size:13.5px;font-variant-numeric:tabular-nums}
.fn-table th{color:#5f7a6c;font-weight:700;text-align:start;padding:8px 6px;border-bottom:1px solid #e3ece6}
.fn-table td{padding:8px 6px;border-bottom:1px solid #eef3f0}.fn-table td.neg{color:#b4452f;font-weight:700}
.fn-hbar{display:grid;grid-template-columns:110px 1fr auto;gap:8px;align-items:center;margin-bottom:8px;font-size:13.5px}
.fn-hbar .track{height:10px;border-radius:999px;background:#eef3f0;overflow:hidden}.fn-hbar .track span{display:block;height:100%;background:#b4452f;border-radius:999px}
.fn-hbar .val{font-weight:700;white-space:nowrap}
.fn-muted{color:#5f7a6c;font-size:13.5px;line-height:1.7;margin:0 0 10px}
.fn-toast{position:fixed;bottom:calc(18px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:#0b2e1f;color:#fff;padding:12px 18px;border-radius:12px;font-weight:700;font-size:14px;z-index:50;box-shadow:0 8px 24px rgba(11,46,31,.25);max-width:calc(100% - 32px)}
@media (max-width:900px){.fn-kpis{grid-template-columns:1fr 1fr}.fn-exp{grid-template-columns:1fr}.fn-form{position:static}.fn-reports{grid-template-columns:1fr}}
@media (max-width:520px){
.fn-tabs-top a{font-size:13px;padding:10px 4px}
.fn-main{padding:12px 12px 40px}
.fn-kpi{padding:12px}.fn-kpi b{font-size:17px}
.fn-nav b{font-size:16px;min-width:100px}
.fn-row{padding:12px}
.fn-pay{width:100%;justify-content:space-between}
.fn-hbar{grid-template-columns:90px 1fr auto}
}
@media (max-width:400px){.fn-tabs-top a{font-size:12.5px}}
`;

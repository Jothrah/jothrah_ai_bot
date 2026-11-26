import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendAdminPushNotification } from "@/lib/admin-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تذكيرات مواعيد الرش — تستدعيها مهمة مجدولة في Supabase (pg_cron) كل 10 دقائق:
 * - 7:00 صباحاً: ملخص مواعيد اليوم
 * - 8:00 مساءً: ملخص مواعيد بكرة
 * - قبل كل موعد مؤكد بساعة تقريباً: تنبيه بالعميل والحي
 */
function riyadhNow() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  return { ymd: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), d };
}
function addDays(ymd: string, n: number) {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function toMinutes(t?: string | null) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function fmt(t?: string | null) {
  const m = toMinutes(t);
  if (m === null) return String(t || "");
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "م" : "ص"}`;
}

async function authorized(req: NextRequest) {
  const given = req.headers.get("x-cron-secret") || "";
  if (!given) return false;
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "cron_secret").maybeSingle();
  return Boolean(data?.value) && data!.value === given;
}

type Row = { id: string; customer_name: string; district: string; confirmed_date: string; confirmed_time: string | null; reminder_sent_at: string | null };

async function dayList(ymd: string) {
  const { data } = await supabaseAdmin
    .from("spray_bookings")
    .select("id, customer_name, district, confirmed_date, confirmed_time, reminder_sent_at")
    .eq("status", "confirmed")
    .eq("confirmed_date", ymd);
  return ((data || []) as Row[]).sort((a, b) => (toMinutes(a.confirmed_time) ?? 1e4) - (toMinutes(b.confirmed_time) ?? 1e4));
}

function summary(rows: Row[]) {
  return rows
    .slice(0, 4)
    .map((r) => `${r.confirmed_time ? fmt(r.confirmed_time) + " " : ""}${r.district}`)
    .join(" · ") + (rows.length > 4 ? ` +${rows.length - 4}` : "");
}

async function run(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ ok: false }, { status: 401 });
  const now = riyadhNow();
  const sent: string[] = [];

  // ملخص الصباح (7:00 - 7:09)
  if (now.minutes >= 7 * 60 && now.minutes < 7 * 60 + 10) {
    const rows = await dayList(now.ymd);
    if (rows.length) {
      await sendAdminPushNotification({ title: `🗓️ مواعيد اليوم (${rows.length})`, body: summary(rows), url: "/admin/bookings" });
      sent.push("morning");
    }
  }
  // ملخص المساء لمواعيد بكرة (20:00 - 20:09)
  if (now.minutes >= 20 * 60 && now.minutes < 20 * 60 + 10) {
    const rows = await dayList(addDays(now.ymd, 1));
    if (rows.length) {
      await sendAdminPushNotification({ title: `🗓️ مواعيد بكرة (${rows.length})`, body: summary(rows), url: "/admin/bookings" });
      sent.push("evening");
    }
  }
  // قبل الموعد بساعة (أي موعد يبدأ خلال 0-70 دقيقة ولم يُذكّر به)
  const today = await dayList(now.ymd);
  for (const r of today) {
    const m = toMinutes(r.confirmed_time);
    if (m === null || r.reminder_sent_at) continue;
    const diff = m - now.minutes;
    if (diff >= 0 && diff <= 70) {
      await sendAdminPushNotification({
        title: `⏰ موعد رش ${diff <= 15 ? "الحين" : `بعد ${diff >= 55 ? "ساعة" : `${diff} دقيقة`}`}`,
        body: `${r.customer_name} — حي ${r.district} — الساعة ${fmt(r.confirmed_time)}`,
        url: `/admin/bookings?id=${encodeURIComponent(r.id)}`,
      });
      await supabaseAdmin.from("spray_bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", r.id);
      sent.push(r.id);
    }
  }
  return NextResponse.json({ ok: true, at: now.d.toISOString(), sent });
}

export async function POST(req: NextRequest) {
  try {
    return await run(req);
  } catch (e) {
    console.error("cron reminders error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
export const GET = POST;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendAdminPushNotification } from "@/lib/admin-push";
import {
  bookingInputSchema,
  insideRiyadh,
  makeBookingRef,
  normalizeSaudiPhone,
  riyadhToday,
} from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders(origin?: string | null) {
  const rawAllowed = process.env.ALLOWED_ORIGIN || "https://jothrah.com";
  const allowed = rawAllowed.split(",").map((s) => s.trim()).filter(Boolean);
  const ok =
    origin &&
    (allowed.includes(origin) || /^https:\/\/([a-z0-9-]+\.)?jothrah\.com$/i.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : allowed[0] || "https://jothrah.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

async function hashIp(ip: string) {
  const data = new TextEncoder().encode(`jothrah-booking:${ip}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function fail(message: string, status: number, headers: Record<string, string>) {
  return NextResponse.json({ ok: false, error: message }, { status, headers });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));
  try {
    const body = await req.json().catch(() => null);
    const parsed = bookingInputSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const msg = first?.path?.[0] === "agree" ? "لازم توافق على أن الحجز غير مؤكد لين نتواصل معك" : first?.message && /[؀-ۿ]/.test(first.message) ? first.message : "تأكد من تعبئة الحقول المطلوبة";
      return fail(msg, 400, headers);
    }
    const input = parsed.data;

    const phone = normalizeSaudiPhone(input.phone);
    if (!phone) return fail("اكتب رقم جوال سعودي صحيح يبدأ بـ 05", 400, headers);

    const hasCoords = typeof input.lat === "number" && typeof input.lng === "number";
    if (hasCoords && !insideRiyadh(input.lat, input.lng)) {
      return fail("الخدمة متوفرة داخل مدينة الرياض فقط، وموقعك يظهر خارجها", 400, headers);
    }

    if (input.preferredDate && input.preferredDate < riyadhToday()) {
      return fail("اختر تاريخ اليوم أو بعده", 400, headers);
    }

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const ipHash = await hashIp(ip);

    // حد بسيط ضد التكرار: 4 حجوزات لكل جهاز/رقم خلال ساعة
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("spray_bookings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .or(`ip_hash.eq.${ipHash},customer_phone.eq.${phone}`);
    if ((count || 0) >= 4) {
      return fail("وصلنا طلبك، وبنتواصل معك قريب. لو عندك تعديل راسلنا على الواتساب.", 429, headers);
    }

    let ref = makeBookingRef();
    let inserted: { id: string; ref: string } | null = null;
    for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
      const { data, error } = await supabaseAdmin
        .from("spray_bookings")
        .insert({
          ref,
          status: "pending",
          customer_name: input.name,
          customer_phone: phone,
          district: input.district,
          address_note: input.addressNote || null,
          place_type: input.placeType,
          place_size: input.placeSize || null,
          pests: input.pests,
          pest_note: input.pestNote || null,
          preferred_date: input.preferredDate || null,
          preferred_period: input.preferredPeriod,
          lat: hasCoords ? input.lat : null,
          lng: hasCoords ? input.lng : null,
          location_accuracy: hasCoords ? input.accuracy ?? null : null,
          customer_notes: input.notes || null,
          source: input.source || null,
          user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
          ip_hash: ipHash,
        })
        .select("id, ref")
        .single();
      if (!error) inserted = data;
      else if (error.code === "23505") ref = makeBookingRef();
      else throw error;
    }
    if (!inserted) throw new Error("ref collision");

    try {
      await sendAdminPushNotification({
        title: "حجز رش جديد 🏠",
        body: `${input.name} — ${input.district} — ${input.pests.join("، ")}`.slice(0, 140),
        url: `/admin/bookings?id=${encodeURIComponent(inserted.id)}`,
      });
    } catch (e) {
      console.error("booking push failed", e);
    }

    return NextResponse.json({ ok: true, ref: inserted.ref }, { headers });
  } catch (error) {
    console.error("POST /api/bookings error:", error);
    return fail("صار خطأ أثناء إرسال الطلب، جرّب مرة ثانية أو راسلنا على الواتساب", 500, headers);
  }
}

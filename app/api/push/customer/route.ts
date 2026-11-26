import { NextRequest, NextResponse } from "next/server";
import { saveCustomerSubscription } from "@/lib/customer-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** المفتاح العام لاشتراك الإشعارات (صفحة notify.html) */
export async function GET() {
  return NextResponse.json({ publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "" });
}

/** حفظ اشتراك إشعارات العميل وربطه بمعرّف الزائر في الدردشة */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const visitorId = String(body?.visitor_id || "").trim().slice(0, 120);
    const sub = body?.subscription || {};
    const endpoint = String(sub.endpoint || "");
    const p256dh = String(sub.keys?.p256dh || "");
    const auth = String(sub.keys?.auth || "");
    if (!visitorId || !/^https:\/\//.test(endpoint) || !p256dh || !auth || endpoint.length > 1000) {
      return NextResponse.json({ ok: false, error: "invalid subscription" }, { status: 400 });
    }
    await saveCustomerSubscription({
      visitorId,
      lang: body?.lang === "en" ? "en" : "ar",
      endpoint,
      p256dh,
      auth,
      userAgent: (req.headers.get("user-agent") || "").slice(0, 300),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST customer push error:", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

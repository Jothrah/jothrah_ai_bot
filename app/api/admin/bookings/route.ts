import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BOOKING_STATUSES } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** قائمة الحجوزات للوحة الإدارة */
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status") || "";
    let q = supabaseAdmin
      .from("spray_bookings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if ((BOOKING_STATUSES as readonly string[]).includes(status)) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ ok: true, bookings: data || [] });
  } catch (error) {
    console.error("GET admin bookings error:", error);
    return NextResponse.json({ ok: false, error: "تعذر تحميل الحجوزات" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ADMIN_PATCH_SCHEMA } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** تحديث حالة الحجز أو الموعد أو المبلغ أو الملاحظة */
export async function PATCH(req: NextRequest, props: Params) {
  try {
    const { id } = await props.params;
    const body = await req.json().catch(() => ({}));
    const parsed = ADMIN_PATCH_SCHEMA.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "بيانات غير صحيحة" }, { status: 400 });
    const p = parsed.data;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (p.status !== undefined) update.status = p.status;
    if (p.adminNote !== undefined) update.admin_note = p.adminNote || null;
    if (p.confirmedDate !== undefined) update.confirmed_date = p.confirmedDate || null;
    if (p.confirmedTime !== undefined) update.confirmed_time = p.confirmedTime || null;
    // تغيير الموعد يعيد تفعيل تذكير «قبل الموعد بساعة»
    if (p.confirmedDate !== undefined || p.confirmedTime !== undefined) update.reminder_sent_at = null;
    if (p.price !== undefined) update.price = p.price;
    if (p.paymentStatus !== undefined) {
      update.payment_status = p.paymentStatus;
      update.paid_at = p.paymentStatus === "paid" ? new Date().toISOString() : null;
    }
    if (p.paymentMethod !== undefined) update.payment_method = p.paymentMethod || null;
    const { data, error } = await supabaseAdmin
      .from("spray_bookings")
      .update(update)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: "الحجز غير موجود" }, { status: 404 });
    return NextResponse.json({ ok: true, booking: data });
  } catch (error) {
    console.error("PATCH admin booking error:", error);
    return NextResponse.json({ ok: false, error: "تعذر حفظ التعديل" }, { status: 500 });
  }
}

/** حذف نهائي للحجز */
export async function DELETE(_req: NextRequest, props: Params) {
  try {
    const { id } = await props.params;
    const { error } = await supabaseAdmin.from("spray_bookings").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE admin booking error:", error);
    return NextResponse.json({ ok: false, error: "تعذر حذف الحجز" }, { status: 500 });
  }
}

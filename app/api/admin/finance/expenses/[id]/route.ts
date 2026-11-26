import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EXPENSE_PATCH_SCHEMA } from "@/lib/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** تعديل مصروف */
export async function PATCH(req: NextRequest, props: Params) {
  try {
    const { id } = await props.params;
    const body = await req.json().catch(() => ({}));
    const parsed = EXPENSE_PATCH_SCHEMA.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "بيانات غير صحيحة" }, { status: 400 });
    const p = parsed.data;
    const update: Record<string, unknown> = {};
    if (p.spentOn !== undefined) update.spent_on = p.spentOn;
    if (p.category !== undefined) update.category = p.category;
    if (p.amount !== undefined) update.amount = p.amount;
    if (p.note !== undefined) update.note = p.note || null;
    if (p.bookingId !== undefined) update.booking_id = p.bookingId || null;
    const { data, error } = await supabaseAdmin.from("finance_expenses").update(update).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: "المصروف غير موجود" }, { status: 404 });
    return NextResponse.json({ ok: true, expense: data });
  } catch (error) {
    console.error("PATCH expense error:", error);
    return NextResponse.json({ ok: false, error: "تعذر حفظ التعديل" }, { status: 500 });
  }
}

/** حذف مصروف */
export async function DELETE(_req: NextRequest, props: Params) {
  try {
    const { id } = await props.params;
    const { error } = await supabaseAdmin.from("finance_expenses").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE expense error:", error);
    return NextResponse.json({ ok: false, error: "تعذر حذف المصروف" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EXPENSE_SCHEMA } from "@/lib/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** إضافة مصروف */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = EXPENSE_SCHEMA.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "تأكد من التاريخ والتصنيف والمبلغ" }, { status: 400 });
    const p = parsed.data;
    const { data, error } = await supabaseAdmin
      .from("finance_expenses")
      .insert({
        spent_on: p.spentOn,
        category: p.category,
        amount: p.amount,
        note: p.note || null,
        booking_id: p.bookingId || null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, expense: data });
  } catch (error) {
    console.error("POST expense error:", error);
    return NextResponse.json({ ok: false, error: "تعذر حفظ المصروف" }, { status: 500 });
  }
}

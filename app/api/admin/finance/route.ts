import { NextResponse } from "next/server";
import { loadFinanceData } from "@/lib/finance-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** بيانات الإدارة المالية: الحجوزات المؤكدة والمنفذة + المصاريف */
export async function GET() {
  try {
    const data = await loadFinanceData();
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error("GET finance error:", error);
    return NextResponse.json({ ok: false, error: "تعذر تحميل البيانات المالية" }, { status: 500 });
  }
}

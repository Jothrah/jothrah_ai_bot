import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** رقم النسخة المنشورة — تطبيق الإدارة يقارنه ويحدّث نفسه تلقائياً بعد أي تعديل */
export async function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "watermark_settings";

/* إعدادات العلامة المائية محفوظة في قاعدة البيانات، فتكون نفسها في الجوال والكمبيوتر */
const SCHEMA = z.object({
  pos: z.enum(["center", "br", "bl", "tile"]),
  size: z.number().min(5).max(90),
  op: z.number().min(5).max(100),
  dx: z.number().min(-60).max(60),
  dy: z.number().min(-60).max(60),
  sq: z.boolean(),
  logo: z.string().max(400000).regex(/^data:image\/(png|webp|svg\+xml);base64,/).nullable(),
});

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from("app_settings").select("value").eq("key", KEY).maybeSingle();
    if (error) throw error;
    let settings = null;
    if (data?.value) {
      try {
        settings = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      } catch {
        settings = null;
      }
    }
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error("GET watermark settings:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = SCHEMA.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "إعدادات غير صحيحة" }, { status: 400 });
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: KEY, value: JSON.stringify(parsed.data) }, { onConflict: "key" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT watermark settings:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** ملاحظة داخلية على العميل — تظهر للإدارة فقط. */
export async function POST(req: NextRequest, props: Params) {
  try {
    const { id } = await props.params;
    const body = await req.json().catch(() => ({}));
    const note = String(body.note || "").replace(/[<>]/g, "").slice(0, 2000);

    const { data: conversation, error: readError } = await supabaseAdmin
      .from("chat_conversations")
      .select("id, metadata")
      .eq("id", id)
      .maybeSingle();

    if (readError) throw readError;
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabaseAdmin
      .from("chat_conversations")
      .update({
        metadata: {
          ...(conversation.metadata || {}),
          admin_note: note,
          admin_note_at: new Date().toISOString(),
        },
      })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true, note });
  } catch (error) {
    console.error("POST admin note error:", error);
    return NextResponse.json({ error: "تعذر حفظ الملاحظة" }, { status: 500 });
  }
}

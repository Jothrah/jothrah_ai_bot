import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** المختص يكتب الآن — يظهر للعميل داخل الدردشة. */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const { data: conversation } = await supabaseAdmin
      .from("chat_conversations")
      .select("id, metadata")
      .eq("id", id)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await supabaseAdmin
      .from("chat_conversations")
      .update({
        metadata: {
          ...(conversation.metadata || {}),
          admin_typing_at: new Date().toISOString(),
        },
      })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST admin typing error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

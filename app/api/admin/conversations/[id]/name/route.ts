import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const conversationId = String(id || "").trim();
    const body = await req.json().catch(() => ({}));
    const customerName = String(body?.customer_name || "").trim().slice(0, 80);

    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: "conversation id is required" },
        { status: 400 },
      );
    }

    if (!customerName || customerName.length < 2) {
      return NextResponse.json(
        { ok: false, error: "customer_name is required" },
        { status: 400 },
      );
    }

    const { data: conversation, error } = await supabaseAdmin
      .from("chat_conversations")
      .update({ customer_name: customerName })
      .eq("id", conversationId)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    console.error("PATCH /api/admin/conversations/[id]/name error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

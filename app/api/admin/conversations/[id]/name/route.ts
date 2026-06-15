import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { saveChatEvent } from "@/lib/chat-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function cleanCustomerName(value: unknown) {
  const text = String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  if (text.length < 2) return "";
  if (/^jth_[a-z0-9_\-]+$/i.test(text)) return "";
  if (/^visitor_[a-z0-9_\-]+$/i.test(text)) return "";
  if (/^guest_[a-z0-9_\-]+$/i.test(text)) return "";

  return text;
}

export async function PATCH(req: NextRequest, props: Params) {
  try {
    const { id } = await props.params;
    const body = await req.json().catch(() => ({}));
    const customerName = cleanCustomerName(
      body.customer_name || body.customerName || body.name,
    );

    if (!id) {
      return NextResponse.json(
        { error: "conversation id is required" },
        { status: 400 },
      );
    }

    if (!customerName) {
      return NextResponse.json(
        { error: "اكتب اسم العميل بشكل واضح" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("chat_conversations")
      .update({
        customer_name: customerName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    await saveChatEvent({
      conversationId: id,
      eventName: "customer_name_updated_by_admin",
      eventData: { customerName },
    });

    return NextResponse.json({ ok: true, conversation: data });
  } catch (error) {
    console.error("PATCH admin customer name error:", error);
    return NextResponse.json(
      { error: "Failed to update customer name" },
      { status: 500 },
    );
  }
}

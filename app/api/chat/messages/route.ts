import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders(origin?: string | null) {
  const rawAllowedOrigins = process.env.ALLOWED_ORIGIN || "https://jothrah.com";
  const allowedOrigins = rawAllowedOrigins
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const allowedOrigin =
    origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0] || "https://jothrah.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const url = new URL(req.url);
    const visitorId = String(url.searchParams.get("customer_key") || url.searchParams.get("visitor_id") || "").trim();
    const conversationId = String(url.searchParams.get("conversation_id") || "").trim();
    const customerName = String(url.searchParams.get("customer_name") || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    const customerPhone = String(url.searchParams.get("customer_phone") || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
    const customerEmail = String(url.searchParams.get("customer_email") || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);

    if (!visitorId && !conversationId) {
      return NextResponse.json(
        { error: "visitor_id or conversation_id is required" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    let conversationQuery = supabaseAdmin
      .from("chat_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(1);

    if (conversationId) {
      conversationQuery = conversationQuery.eq("id", conversationId);
    } else {
      // V116: لا نرجع المحادثات المغلقة للعميل في المتجر.
      // بعد إنهاء المحادثة من الأدمن، واجهة العميل تبدأ من جديد بدل الدخول في حلقة محادثة مغلقة.
      conversationQuery = conversationQuery
        .eq("visitor_id", visitorId)
        .neq("status", "closed");
    }

    const { data: conversations, error: conversationError } = await conversationQuery;
    if (conversationError) throw conversationError;

    const conversation = conversations?.[0];

    if (!conversation) {
      return NextResponse.json(
        { conversation: null, messages: [] },
        { headers: corsHeaders(origin) }
      );
    }

    if (customerName || customerPhone || customerEmail) {
      const updatePayload: Record<string, string> = {};
      if (customerName && customerName !== conversation.customer_name) updatePayload.customer_name = customerName;
      if (customerPhone && customerPhone !== conversation.customer_phone) updatePayload.customer_phone = customerPhone;
      if (customerEmail && customerEmail !== conversation.customer_email) updatePayload.customer_email = customerEmail;

      if (Object.keys(updatePayload).length) {
        const { data: updatedConversation, error: updateError } = await supabaseAdmin
          .from("chat_conversations")
          .update(updatePayload)
          .eq("id", conversation.id)
          .select("*")
          .single();

        if (updateError) throw updateError;
        Object.assign(conversation, updatedConversation || {});
      }
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("chat_messages")
      .select("id, conversation_id, sender_type, message, image_url, created_at, metadata, visible_to_customer")
      .eq("conversation_id", conversation.id)
      .eq("visible_to_customer", true)
      .order("created_at", { ascending: true })
      .limit(200);

    if (messagesError) throw messagesError;

    return NextResponse.json(
      {
        conversation: {
          id: conversation.id,
          visitor_id: conversation.visitor_id,
          customer_name: conversation.customer_name,
          customer_phone: conversation.customer_phone,
          customer_email: conversation.customer_email,
          language: conversation.language,
          status: conversation.status,
          needs_human: conversation.needs_human,
          human_requested_at: conversation.human_requested_at,
          last_message_at: conversation.last_message_at,
          last_customer_message_at: conversation.last_customer_message_at,
          last_human_reply_at: conversation.last_human_reply_at,
          closed_at: conversation.closed_at,
          rating: conversation.rating,
          rated_at: conversation.rated_at,
          metadata: conversation.metadata || {}
        },
        messages: messages || []
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error("GET /api/chat/messages error:", error);
    return NextResponse.json(
      { error: "Failed to load chat messages" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}

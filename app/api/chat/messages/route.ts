import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders(origin?: string | null) {
  const rawAllowedOrigins =
    process.env.ALLOWED_ORIGIN || "https://jothrah.com";

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
  return NextResponse.json(
    {},
    { headers: corsHeaders(req.headers.get("origin")) }
  );
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const url = new URL(req.url);

    const visitorId = String(url.searchParams.get("visitor_id") || "").trim();
    const conversationId = String(
      url.searchParams.get("conversation_id") || ""
    ).trim();

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
      conversationQuery = conversationQuery.eq("visitor_id", visitorId);
    }

    const { data: conversations, error: conversationError } =
      await conversationQuery;

    if (conversationError) {
      throw conversationError;
    }

    const conversation = conversations?.[0];

    if (!conversation) {
      return NextResponse.json(
        {
          conversation: null,
          messages: []
        },
        { headers: corsHeaders(origin) }
      );
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("chat_messages")
      .select(
        "id, conversation_id, sender_type, message, image_url, created_at, metadata"
      )
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (messagesError) {
      throw messagesError;
    }

    return NextResponse.json(
      {
        conversation: {
          id: conversation.id,
          visitor_id: conversation.visitor_id,
          status: conversation.status,
          needs_human: conversation.needs_human,
          last_message_at: conversation.last_message_at
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
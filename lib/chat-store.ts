import { supabaseAdmin, CHAT_ATTACHMENTS_BUCKET } from "@/lib/supabase-admin";

type UpsertConversationInput = {
  visitorId: string;
  language: "ar" | "en";
  message?: string;
  pageUrl?: string;
  userAgent?: string;
  needsHuman?: boolean;
};

type SaveMessageInput = {
  conversationId: string;
  senderType: "customer" | "ai" | "human" | "system";
  message?: string;
  imageUrl?: string | null;
  aiDetectedProblem?: string;
  aiConfidence?: string;
  aiWhatsappNeeded?: boolean;
  metadata?: Record<string, unknown>;
};

function safeFileExt(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

export function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);

  if (!match) {
    throw new Error("INVALID_DATA_URL");
  }

  const mime = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");

  return {
    mime,
    buffer,
    ext: safeFileExt(mime)
  };
}

export async function uploadChatImage(params: {
  conversationId: string;
  imageDataUrl: string;
}) {
  const { conversationId, imageDataUrl } = params;
  const { mime, buffer, ext } = dataUrlToBuffer(imageDataUrl);

  const filePath = `${conversationId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .upload(filePath, buffer, {
      contentType: mime,
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data } = await supabaseAdmin.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUrl(filePath, 60 * 60 * 24 * 7);

  return {
    filePath,
    signedUrl: data?.signedUrl || null,
    mime,
    size: buffer.length
  };
}

export async function upsertConversation(input: UpsertConversationInput) {
  const {
    visitorId,
    language,
    message,
    pageUrl,
    userAgent,
    needsHuman = false
  } = input;

  const existing = await supabaseAdmin
    .from("chat_conversations")
    .select("*")
    .eq("visitor_id", visitorId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) {
    const { data, error } = await supabaseAdmin
      .from("chat_conversations")
      .update({
        language,
        last_message: message || existing.data.last_message,
        last_message_at: new Date().toISOString(),
        page_url: pageUrl || existing.data.page_url,
        user_agent: userAgent || existing.data.user_agent,
        needs_human: existing.data.needs_human || needsHuman,
        status: needsHuman ? "needs_human" : existing.data.status
      })
      .eq("id", existing.data.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("chat_conversations")
    .insert({
      visitor_id: visitorId,
      language,
      status: needsHuman ? "needs_human" : "ai",
      source: "salla",
      needs_human: needsHuman,
      human_requested_at: needsHuman ? new Date().toISOString() : null,
      last_message: message || "",
      last_message_at: new Date().toISOString(),
      page_url: pageUrl || null,
      user_agent: userAgent || null
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function saveChatMessage(input: SaveMessageInput) {
  const {
    conversationId,
    senderType,
    message,
    imageUrl,
    aiDetectedProblem,
    aiConfidence,
    aiWhatsappNeeded,
    metadata
  } = input;

  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_type: senderType,
      message: message || null,
      image_url: imageUrl || null,
      ai_detected_problem: aiDetectedProblem || null,
      ai_confidence: aiConfidence || null,
      ai_whatsapp_needed: Boolean(aiWhatsappNeeded),
      metadata: metadata || {}
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function saveChatAttachment(params: {
  conversationId: string;
  messageId?: string;
  fileUrl: string;
  fileType?: string;
  fileName?: string;
  fileSize?: number;
}) {
  const { data, error } = await supabaseAdmin
    .from("chat_attachments")
    .insert({
      conversation_id: params.conversationId,
      message_id: params.messageId || null,
      file_url: params.fileUrl,
      file_type: params.fileType || null,
      file_name: params.fileName || null,
      file_size: params.fileSize || null
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function saveChatEvent(params: {
  conversationId?: string;
  visitorId?: string;
  eventName: string;
  eventData?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("chat_events").insert({
    conversation_id: params.conversationId || null,
    visitor_id: params.visitorId || null,
    event_name: params.eventName,
    event_data: params.eventData || {}
  });
}
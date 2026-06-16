import { supabaseAdmin, CHAT_ATTACHMENTS_BUCKET } from "@/lib/supabase-admin";

type Language = "ar" | "en";

type UpsertConversationInput = {
  visitorId: string;
  language: Language;
  message?: string;
  pageUrl?: string;
  userAgent?: string;
  needsHuman?: boolean;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerKey?: string;
  metadata?: Record<string, unknown>;
};

type SaveMessageInput = {
  conversationId: string;
  senderType: "customer" | "ai" | "human" | "system";
  message?: string;
  imageUrl?: string | null;
  aiDetectedProblem?: string | null;
  aiConfidence?: string | null;
  aiWhatsappNeeded?: boolean;
  visibleToCustomer?: boolean;
  metadata?: Record<string, unknown>;
};

function cleanText(value?: string | null, max = 250) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

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
    needsHuman = false,
    customerName,
    customerPhone,
    customerEmail,
    customerKey,
    metadata
  } = input;

  const cleanName = cleanText(customerName, 80);
  const cleanPhone = cleanText(customerPhone, 40);
  const cleanEmail = cleanText(customerEmail, 120);
  const cleanCustomerKey = cleanText(customerKey, 120).replace(/[^a-zA-Z0-9_\-:.]/g, "");
  const identityVisitorId = cleanCustomerKey || visitorId;
  const now = new Date().toISOString();

  const existing = await supabaseAdmin
    .from("chat_conversations")
    .select("*")
    .eq("visitor_id", identityVisitorId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data?.id && existing.data.status !== "closed") {
    const nextStatus = needsHuman
      ? "needs_human"
      : existing.data.status || "ai";

    const { data, error } = await supabaseAdmin
      .from("chat_conversations")
      .update({
        language,
        customer_name: cleanName || existing.data.customer_name,
        customer_phone: cleanPhone || existing.data.customer_phone,
        customer_email: cleanEmail || existing.data.customer_email,
        last_message: message || existing.data.last_message,
        last_message_at: now,
        last_customer_message_at: message ? now : existing.data.last_customer_message_at,
        page_url: pageUrl || existing.data.page_url,
        user_agent: userAgent || existing.data.user_agent,
        needs_human: Boolean(existing.data.needs_human || needsHuman || nextStatus === "needs_human"),
        human_requested_at:
          needsHuman && !existing.data.human_requested_at
            ? now
            : existing.data.human_requested_at,
        status: nextStatus,
        unread_admin_count:
          (Number(existing.data.unread_admin_count || 0) || 0) + (message ? 1 : 0),
        metadata: {
          ...(existing.data.metadata || {}),
          ...(metadata || {}),
          customerKey: cleanCustomerKey || (metadata as any)?.customerKey || null,
          identityMode: cleanCustomerKey ? "logged_customer" : ((metadata as any)?.identityMode || "visitor")
        }
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
      visitor_id: identityVisitorId,
      customer_name: cleanName || null,
      customer_phone: cleanPhone || null,
      customer_email: cleanEmail || null,
      language,
      status: needsHuman ? "needs_human" : "ai",
      source: "salla",
      needs_human: needsHuman,
      human_requested_at: needsHuman ? now : null,
      last_message: message || "",
      last_message_at: now,
      last_customer_message_at: message ? now : null,
      unread_admin_count: message ? 1 : 0,
      page_url: pageUrl || null,
      user_agent: userAgent || null,
      metadata: {
        ...(metadata || {}),
        customerKey: cleanCustomerKey || (metadata as any)?.customerKey || null,
        identityMode: cleanCustomerKey ? "logged_customer" : ((metadata as any)?.identityMode || "visitor")
      }
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
    visibleToCustomer = true,
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
      visible_to_customer: visibleToCustomer,
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

export async function getLatestConversationByVisitor(visitorId: string) {
  const { data, error } = await supabaseAdmin
    .from("chat_conversations")
    .select("*")
    .eq("visitor_id", visitorId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function markConversationHumanRequested(conversationId: string) {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("chat_conversations")
    .update({
      status: "needs_human",
      needs_human: true,
      human_requested_at: now,
      last_message_at: now
    })
    .eq("id", conversationId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteConversationForever(conversationId: string) {
  await supabaseAdmin.from("chat_attachments").delete().eq("conversation_id", conversationId);
  await supabaseAdmin.from("chat_events").delete().eq("conversation_id", conversationId);
  await supabaseAdmin.from("chat_messages").delete().eq("conversation_id", conversationId);

  const { error } = await supabaseAdmin
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId);

  if (error) throw error;
}

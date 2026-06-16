import { NextResponse } from "next/server";
import { supabaseAdmin, CHAT_ATTACHMENTS_BUCKET } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type AttachmentRow = {
  file_name?: string | null;
  file_url?: string | null;
};

type MessageRow = {
  image_url?: string | null;
};

function normalizeStoragePath(value?: string | null, conversationId?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (!raw.includes("://")) {
    const clean = raw.replace(/^\/+/, "");
    if (conversationId && !clean.includes("/") && clean.includes(".")) {
      return `${conversationId}/${clean}`;
    }
    return clean;
  }

  try {
    const url = new URL(raw);
    const decodedPath = decodeURIComponent(url.pathname);
    const marker = `/${CHAT_ATTACHMENTS_BUCKET}/`;
    const index = decodedPath.indexOf(marker);

    if (index >= 0) {
      return decodedPath.slice(index + marker.length).replace(/^\/+/, "");
    }

    const fallbackMarker = "/storage/v1/object/";
    const fallbackIndex = decodedPath.indexOf(fallbackMarker);
    if (fallbackIndex >= 0) {
      const tail = decodedPath.slice(fallbackIndex + fallbackMarker.length);
      return tail
        .replace(/^public\//, "")
        .replace(/^sign\//, "")
        .replace(new RegExp(`^${CHAT_ATTACHMENTS_BUCKET}/`), "")
        .replace(/^\/+/, "");
    }
  } catch {
    return "";
  }

  return "";
}

function uniq(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().replace(/^\/+/, ""))
        .filter(Boolean),
    ),
  );
}

async function collectStoragePaths(conversationId: string) {
  const paths: string[] = [];

  const attachments = await supabaseAdmin
    .from("chat_attachments")
    .select("file_name,file_url")
    .eq("conversation_id", conversationId);

  if (attachments.error) throw attachments.error;

  for (const item of (attachments.data || []) as AttachmentRow[]) {
    const byName = normalizeStoragePath(item.file_name, conversationId);
    const byUrl = normalizeStoragePath(item.file_url, conversationId);
    if (byName) paths.push(byName);
    if (byUrl) paths.push(byUrl);
  }

  const messages = await supabaseAdmin
    .from("chat_messages")
    .select("image_url")
    .eq("conversation_id", conversationId)
    .not("image_url", "is", null);

  if (messages.error) throw messages.error;

  for (const item of (messages.data || []) as MessageRow[]) {
    const byUrl = normalizeStoragePath(item.image_url, conversationId);
    if (byUrl) paths.push(byUrl);
  }

  const listed = await supabaseAdmin.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .list(conversationId, { limit: 1000 });

  if (!listed.error) {
    for (const file of listed.data || []) {
      if (file?.name) paths.push(`${conversationId}/${file.name}`);
    }
  } else {
    console.warn("Storage list failed while deleting conversation:", listed.error.message);
  }

  return uniq(paths);
}

async function removeStoragePaths(paths: string[]) {
  const errors: string[] = [];

  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    if (!chunk.length) continue;

    const { error } = await supabaseAdmin.storage
      .from(CHAT_ATTACHMENTS_BUCKET)
      .remove(chunk);

    if (error) {
      console.warn("Storage remove failed while deleting conversation:", error.message);
      errors.push(error.message);
    }
  }

  return errors;
}

export async function DELETE(_req: Request, props: Params) {
  try {
    const { id } = await props.params;

    if (!id) {
      return NextResponse.json({ error: "conversation id is required" }, { status: 400 });
    }

    const storagePaths = await collectStoragePaths(id);
    const storageErrors = await removeStoragePaths(storagePaths);

    const attachmentsDelete = await supabaseAdmin
      .from("chat_attachments")
      .delete()
      .eq("conversation_id", id);
    if (attachmentsDelete.error) throw attachmentsDelete.error;

    const eventsDelete = await supabaseAdmin
      .from("chat_events")
      .delete()
      .eq("conversation_id", id);
    if (eventsDelete.error) throw eventsDelete.error;

    const messagesDelete = await supabaseAdmin
      .from("chat_messages")
      .delete()
      .eq("conversation_id", id);
    if (messagesDelete.error) throw messagesDelete.error;

    const conversationDelete = await supabaseAdmin
      .from("chat_conversations")
      .delete()
      .eq("id", id);
    if (conversationDelete.error) throw conversationDelete.error;

    return NextResponse.json({
      ok: true,
      deletedStorageFiles: storagePaths.length,
      storageWarning: storageErrors.length ? storageErrors.join(" | ") : null,
    });
  } catch (error) {
    console.error("DELETE admin conversation error:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 },
    );
  }
}

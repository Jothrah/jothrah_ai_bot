import { NextResponse } from "next/server";
import { deleteConversationForever } from "@/lib/chat-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, props: Params) {
  try {
    const { id } = await props.params;

    if (!id) {
      return NextResponse.json({ error: "conversation id is required" }, { status: 400 });
    }

    await deleteConversationForever(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE admin conversation error:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}

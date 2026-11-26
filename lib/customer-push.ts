import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** إشعارات الجوال/المتصفح للعملاء: تنبيه العميل فور رد فريق جذرة عليه */

let ready = false;
function setup() {
  if (ready) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:info@jothrah.com", publicKey, privateKey);
  ready = true;
  return true;
}

export async function saveCustomerSubscription(params: {
  visitorId: string;
  lang: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const { error } = await supabaseAdmin.from("customer_push_subscriptions").upsert(
    {
      visitor_id: params.visitorId,
      lang: params.lang,
      endpoint: params.endpoint,
      p256dh: params.p256dh,
      auth: params.auth,
      user_agent: params.userAgent || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

/** يرسل تنبيه لكل أجهزة العميل صاحب المحادثة */
export async function notifyCustomerOfReply(conversationId: string, replyText: string) {
  if (!setup()) return;
  const { data: conv } = await supabaseAdmin
    .from("chat_conversations")
    .select("visitor_id")
    .eq("id", conversationId)
    .maybeSingle();
  const visitorId = conv?.visitor_id;
  if (!visitorId) return;

  const { data: subs } = await supabaseAdmin
    .from("customer_push_subscriptions")
    .select("id, endpoint, p256dh, auth, lang")
    .eq("visitor_id", visitorId)
    .eq("is_active", true)
    .limit(5);
  if (!subs?.length) return;

  await Promise.allSettled(
    subs.map(async (s) => {
      const en = s.lang === "en";
      const payload = JSON.stringify({
        title: en ? "💬 Reply from Jothrah" : "💬 رد من فريق جذرة",
        body: String(replyText || "").replace(/\s+/g, " ").slice(0, 140),
        url: `https://jothrah.com/${en ? "en" : "ar"}?jth_chat=1`,
      });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        await supabaseAdmin.from("customer_push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", s.id);
      } catch (error: any) {
        const code = Number(error?.statusCode || 0);
        if (code === 404 || code === 410) {
          await supabaseAdmin.from("customer_push_subscriptions").update({ is_active: false }).eq("id", s.id);
        }
        console.error("customer push error:", error?.message || error);
      }
    }),
  );
}

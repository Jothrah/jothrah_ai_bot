import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type AdminPushPayload = {
  title?: string;
  body?: string;
  url?: string;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function setupWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:info@jothrah.com";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID keys");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendAdminPushNotification(payload: AdminPushPayload) {
  setupWebPush();

  const supabase = getSupabaseAdmin();

  const { data: subscriptions, error } = await supabase
    .from("admin_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("is_active", true);

  if (error) {
    console.error("Push subscriptions fetch error:", error.message);
    return;
  }

  if (!subscriptions?.length) return;

  const notificationPayload = JSON.stringify({
    title: payload.title || "محادثة جديدة في جذرة",
    body: payload.body || "افتح لوحة المحادثات للرد.",
    url: payload.url || "/admin/conversations",
  });

  await Promise.allSettled(
    subscriptions.map(async (item) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: item.endpoint,
            keys: {
              p256dh: item.p256dh,
              auth: item.auth,
            },
          },
          notificationPayload,
        );

        await supabase
          .from("admin_push_subscriptions")
          .update({
            last_sent_at: new Date().toISOString(),
            is_active: true,
          })
          .eq("id", item.id);
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || 0);

        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("admin_push_subscriptions")
            .update({
              is_active: false,
            })
            .eq("id", item.id);
        }

        console.error("Push send error:", error?.message || error);
      }
    }),
  );
}
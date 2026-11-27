import { WATERMARK_HTML } from "@/lib/watermark-html";

export const dynamic = "force-dynamic";

/** أداة العلامة المائية — محمية بتسجيل دخول الإدارة (middleware على /admin) */
export async function GET() {
  return new Response(WATERMARK_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/products";
import { catalogStatus, ensureCatalog } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** بحث منتجات المتجر لإدراج رابط منتج داخل رد المختص. */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  // ?catalog=1 ← حالة كتالوج البوت (من سلة أو من الملف، العدد، آخر تحديث)
  if (params.get("catalog")) {
    await ensureCatalog(15000);
    return NextResponse.json(catalogStatus(), { headers: { "Cache-Control": "no-store" } });
  }
  await ensureCatalog();
  const q = params.get("q") || "";
  const items = searchProducts(q, 8).map((p) => ({
    id: p.id,
    name: p.name,
    url: p.url,
    image: p.image,
    size: p.size,
  }));
  return NextResponse.json({ items });
}

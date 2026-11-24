import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** بحث منتجات المتجر لإدراج رابط منتج داخل رد المختص. */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q") || "";
  const items = searchProducts(q, 8).map((p) => ({
    id: p.id,
    name: p.name,
    url: p.url,
    image: p.image,
    size: p.size,
  }));
  return NextResponse.json({ items });
}

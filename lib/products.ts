import productsData from "@/data/products.json";

export type StoreProduct = {
  id: string;
  name: string;
  url: string;
  image: string;
  categories: string[];
  brand: string;
  size: string;
  active: string;
  conc: string;
  targets: string[];
  summary: string;
};

export type ProductCard = {
  id: string;
  name: string;
  url: string;
  image: string;
  size: string;
  active: string;
  reason: string;
};

const products = productsData as StoreProduct[];
const byId = new Map(products.map((p) => [String(p.id), p]));

let catalogCache = "";

/**
 * فهرس مختصر لكل منتجات المتجر يُرسل للنموذج.
 * يوضع في بداية رسائل النظام حتى يستفيد من التخزين المؤقت للـ prompt.
 */
export function buildCatalogIndex() {
  if (catalogCache) return catalogCache;

  catalogCache = products
    .map((p) => {
      const parts = [p.id, p.name];
      if (p.size && !p.name.includes(p.size)) parts.push(p.size);
      if (p.active) parts.push(`مادة فعالة: ${p.active}${p.conc ? " " + p.conc : ""}`);
      if (p.targets?.length) parts.push(`يستهدف: ${p.targets.slice(0, 5).join("، ")}`);
      if (p.categories?.length) parts.push(`تصنيف: ${p.categories.slice(0, 3).join("، ")}`);
      return parts.join(" | ");
    })
    .join("\n");

  return catalogCache;
}

export function getProductById(id: unknown) {
  return byId.get(String(id || "").trim()) || null;
}

export function hydrateProductSuggestions(
  suggestions: Array<{ id?: string; reason?: string }> | undefined,
  max = 4,
): ProductCard[] {
  const seen = new Set<string>();
  const cards: ProductCard[] = [];

  for (const item of suggestions || []) {
    const product = getProductById(item?.id);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);

    cards.push({
      id: product.id,
      name: product.name,
      url: product.url,
      image: product.image,
      size: product.size,
      active: product.active ? `${product.active}${product.conc ? " " + product.conc : ""}` : "",
      reason: String(item?.reason || "").slice(0, 160),
    });

    if (cards.length >= max) break;
  }

  return cards;
}

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** بحث نصي سريع (للوحة التحكم: إدراج رابط منتج في الرد). */
export function searchProducts(query: string, limit = 8) {
  const q = normalize(query);
  if (!q) return products.slice(0, limit);
  const words = q.split(" ").filter((w) => w.length > 1);

  return products
    .map((p) => {
      const hay = normalize(
        [p.name, p.active, p.brand, p.size, ...(p.targets || []), ...(p.categories || []), p.url].join(" "),
      );
      let score = hay.includes(q) ? 10 : 0;
      for (const w of words) if (hay.includes(w)) score += 2;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

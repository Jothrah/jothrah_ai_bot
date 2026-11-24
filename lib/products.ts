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

/** نوع المنتج العام — يمنع البوت من خلط الأنواع (مثل اقتراح بذور لسؤال عن سماد). */
export function productType(p: StoreProduct) {
  const c = (p.categories || []).join(" ") + " " + p.name;
  if (/^بذور/.test(p.name) || (/البذور الزراعية|بذور الخضروات/.test(c) && !/مبيد/.test(c))) return "بذور";
  if (/سماد|أسمدة|الأسمدة|محفز|منشط|مخلبي|أحماض أمينية|تربة|NPK|طحالب|مستخلص/.test(c)) return "سماد";
  if (/فئران|قوارض|طعوم لينة/.test(c)) return "قوارض";
  if (/مصائد|مصيدة|لاصق/.test(c)) return "مصائد";
  if (/مرشة|معدات|أدوات|عصا/.test(c)) return "معدات";
  if (/فطري|البياض|عفن|أعفان|لفحة/.test(c)) return "مبيد فطري";
  if (/أعشاب|حشائش/.test(c)) return "مبيد أعشاب";
  if (/صحة عامة|الصحة العامة/.test(c)) return "مبيد صحة عامة";
  if (/المبيدات الزراعية|زراعية|زراعي|أكاروسي|عناكب|حشري/.test(c)) return "مبيد زراعي";
  if (/صراصير|بعوض|ذباب|نمل|بق/.test(c)) return "مبيد صحة عامة";
  return "أخرى";
}

/**
 * فهرس مختصر لكل منتجات المتجر يُرسل للنموذج.
 * يوضع في بداية رسائل النظام حتى يستفيد من التخزين المؤقت للـ prompt.
 */
export function buildCatalogIndex() {
  if (catalogCache) return catalogCache;

  // فهرس مضغوط (المعرّف + الاسم + المادة الفعالة) لتسريع رد البوت
  catalogCache = products
    .map((p) => {
      const parts = [p.id, `[${productType(p)}]`, p.name];
      if (p.active && !p.name.includes(p.active)) parts.push(p.active);
      return parts.join("|");
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
  customerText = "",
): ProductCard[] {
  const asksSeeds = /بذور|بذر|بذره|بذرة|شتل|seed/i.test(customerText);
  const seen = new Set<string>();
  const cards: ProductCard[] = [];

  for (const item of suggestions || []) {
    const product = getProductById(item?.id);
    if (!product || seen.has(product.id)) continue;
    if (productType(product) === "بذور" && !asksSeeds) continue;
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

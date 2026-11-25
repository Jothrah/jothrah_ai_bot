import productsData from "@/data/products.json";
import { unstable_cache } from "next/cache";
import { after } from "next/server";

/**
 * كتالوج المتجر الحي:
 * - يقرأ المنتجات مباشرة من واجهة سلة العامة (نفس المصدر اللي يعرض منه المتجر منتجاته)
 * - يتحدث تلقائياً كل ساعة، فأي منتج يُرفع أو يُعدّل أو يُحذف في سلة يعرفه البوت بدون رفع ملفات
 * - يكمّل المادة الفعالة والتصنيفات من data/products.json للمنتجات القديمة اللي وصفها ما فيه "المادة الفعالة"
 * - إذا تعطل الاتصال بسلة يبقى على آخر نسخة ناجحة (أو الملف) حتى لا يتوقف البوت
 */

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

const STORE_ID = process.env.SALLA_STORE_ID || "446051475";
const API = "https://api.salla.dev/store/v1/products";
const TTL_MS = 3 * 60 * 1000; // النسخة المحلية تُراجع كل 3 دقائق (من الكاش المشترك، سريع)
const SHARED_TTL_S = 15 * 60; // الكاش المشترك بين كل نسخ الخادم يُجدد من سلة كل ربع ساعة
const RETRY_MS = 5 * 60 * 1000; // بعد فشل: نعيد المحاولة بعد 5 دقائق
const MAX_PAGES = 80;
const MIN_VALID = 50; // أقل من هذا العدد نعتبر الرد غير سليم ولا نستبدل الكتالوج

const fileProducts = productsData as StoreProduct[];
const fileById = new Map(fileProducts.map((p) => [String(p.id), p]));

let current: StoreProduct[] = fileProducts;
let byId = new Map(current.map((p) => [String(p.id), p]));
let version = 0;
let loadedAt = 0;
let nextTryAt = 0;
let source: "file" | "salla" = "file";
let lastError = "";
let inflight: Promise<void> | null = null;

/* ترقيم ثابت للكتالوج: الرقم اللي يرشح به النموذج المنتج ما يتغير داخل نفس النسخة.
 * منتجات الملف أولاً بترتيبها، والجديدة تأخذ أرقاماً بعدها، والمحذوف يبقى رقمه محجوزاً. */
const numberOf = new Map<string, number>();
const idByNumber: string[] = [];
function assignNumber(id: string) {
  if (!numberOf.has(id)) {
    idByNumber.push(id);
    numberOf.set(id, idByNumber.length);
  }
}
fileProducts.forEach((p) => assignNumber(String(p.id)));

const listeners: Array<() => void> = [];
export function onCatalogChange(fn: () => void) {
  listeners.push(fn);
}

export function catalogProducts() {
  return current;
}
export function catalogNumber(id: string) {
  return numberOf.get(String(id));
}
export function productByNumber(n: number) {
  const id = idByNumber[n - 1];
  return id ? byId.get(id) || null : null;
}
export function productById(id: string) {
  return byId.get(String(id)) || null;
}
export function catalogStatus() {
  return {
    source,
    count: current.length,
    version,
    loadedAt: loadedAt ? new Date(loadedAt).toISOString() : null,
    lastError: lastError || null,
  };
}

/* ---------- قراءة وصف المنتج ---------- */
const LABELS = "المادة الفعالة|المواد الفعالة|التركيز|وزن العبوة|الوزن|الحجم|السعة|نوع المبيد|نوع السماد|الهيئة|المجموعة الكيميائية|الاستخدام|الشركة المصنعة|بلد المنشأ|العبوة|التركيبة|مدة|فترة";

function plainText(html: string) {
  return String(html || "")
    .replace(/<\s*(br|\/p|\/h\d|\/li|\/div)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function field(text: string, label: string) {
  const re = new RegExp(`(?:${label})\\s*[:：]\\s*([\\s\\S]{1,90}?)(?=\\s*(?:${LABELS})\\s*[:：]|\\n|$)`);
  const m = re.exec(text);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

function section(text: string, heading: string) {
  const re = new RegExp(`${heading}\\s*([\\s\\S]{1,200}?)(?=\\s*(?:مميزات المنتج|معلومات المنتج|تفاصيل|طريقة الاستخدام|إرشادات|المجموعة|$))`);
  const m = re.exec(text);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

type SallaProduct = {
  id: number | string;
  name?: string;
  description?: string;
  url?: string;
  image?: { url?: string } | null;
  category?: { name?: string } | null;
  brand?: { name?: string } | null;
  promotion_title?: string | null;
  subtitle?: string | null;
  status?: string;
  is_available?: boolean;
  is_out_of_stock?: boolean;
};

function mapProduct(p: SallaProduct): StoreProduct | null {
  const id = String(p.id || "");
  if (!id || !p.name) return null;
  const old = fileById.get(id);
  const text = plainText(p.description || "");
  const activeFull = field(text, "المادة الفعالة|المواد الفعالة");
  const concField = field(text, "التركيز");
  // "إميداكلوبريد 25% و/و" ← المادة + التركيز
  const pct = /^(.*?)\s*([\d.]+\s*%.*)$/.exec(activeFull);
  const active = (pct ? pct[1] : activeFull).trim() || old?.active || "";
  const conc = concField || (pct ? pct[2].trim() : "") || old?.conc || "";
  const targetsText = section(text, "الآفات المستهدفة");
  const summary = text.split("\n").map((s) => s.trim()).find((s) => s.length > 30)?.slice(0, 220) || old?.summary || "";
  // العنوان الفرعي (مبيد حشري صحة عامة / سماد زراعي...) يحدد نوع المنتج للمنتجات الجديدة
  const cats = [p.category?.name || "", p.subtitle || "", ...(old?.categories || [])].filter(Boolean);
  return {
    id,
    name: p.name,
    url: p.url || old?.url || "",
    image: p.image?.url || "",
    categories: [...new Set(cats)],
    brand: p.brand?.name || old?.brand || "",
    size: p.promotion_title || old?.size || "",
    active,
    conc,
    targets: targetsText ? [targetsText] : old?.targets || [],
    summary,
  };
}

async function fetchPage(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      headers: { "Store-Identifier": STORE_ID, "Accept-Language": "ar", Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as { data?: SallaProduct[]; cursor?: { next?: string | null } };
  } finally {
    clearTimeout(t);
  }
}

/** يسحب كل منتجات المتجر من سلة (صفحة بعد صفحة) ويحولها لصيغة البوت. */
async function fetchAllFromSalla(): Promise<StoreProduct[]> {
  const all: SallaProduct[] = [];
  let url: string | null = `${API}?per_page=100`;
  let pages = 0;
  while (url && pages < MAX_PAGES) {
    const j = await fetchPage(url);
    all.push(...(j.data || []));
    url = j.cursor?.next || null;
    pages++;
  }
  const seen = new Set<string>();
  const mapped: StoreProduct[] = [];
  for (const p of all) {
    // المنتجات النافدة أو غير المتاحة لا يقترحها البوت
    if (p.is_available === false || p.is_out_of_stock || p.status === "out") continue;
    const m = mapProduct(p);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    mapped.push(m);
  }
  // رد ناقص من سلة ← نرمي خطأ حتى لا يُحفظ في الكاش ولا يستبدل الكتالوج
  if (mapped.length < MIN_VALID) throw new Error(`only ${mapped.length} products`);
  return mapped;
}

// كاش مشترك بين كل نسخ الخادم (Vercel Data Cache): السحب من سلة مرة بالساعة فقط،
// وبعدها كل نسخة تقرأ النتيجة جاهزة بدل 20 طلب متتالي.
const cachedCatalog = unstable_cache(fetchAllFromSalla, ["jothrah-salla-catalog-v1"], { revalidate: SHARED_TTL_S });

async function refresh() {
  try {
    const mapped = await cachedCatalog();
    mapped.forEach((p) => assignNumber(p.id));
    mapped.sort((a, b) => (numberOf.get(a.id) || 0) - (numberOf.get(b.id) || 0));
    current = mapped;
    byId = new Map(mapped.map((p) => [p.id, p]));
    source = "salla";
    lastError = "";
    loadedAt = Date.now();
    nextTryAt = loadedAt + TTL_MS;
    version++;
    for (const fn of listeners) {
      try {
        fn();
      } catch {}
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    nextTryAt = Date.now() + RETRY_MS;
    console.warn("catalog refresh failed:", lastError);
  }
}

/**
 * يحدّث الكتالوج إذا مرت ساعة. ينتظر بحد أقصى waitMs حتى لا يتأخر رد العميل؛
 * إذا ما خلص التحديث يكمل الرد بالنسخة الحالية والتحديث يكمل بالخلفية.
 */
export async function ensureCatalog(waitMs = 2500) {
  if (Date.now() < nextTryAt) return;
  if (!inflight) {
    inflight = refresh().finally(() => (inflight = null));
    // نخلي الخادم يكمل التحديث حتى بعد إرسال الرد للعميل
    try {
      after(() => inflight || undefined);
    } catch {}
  }
  await Promise.race([inflight, new Promise((r) => setTimeout(r, waitMs))]);
}

import { catalogProducts, catalogNumber, onCatalogChange, productById, productByNumber, type StoreProduct } from "@/lib/catalog";

export type { StoreProduct };

export type ProductCard = {
  id: string;
  name: string;
  url: string;
  image: string;
  size: string;
  active: string;
  reason: string;
};

// الكتالوج الحي من سلة (lib/catalog.ts) — يتحدث تلقائياً
let products: StoreProduct[] = catalogProducts();

let catalogCache = "";
onCatalogChange(() => {
  products = catalogProducts();
  catalogCache = "";
  activeSkelCache = null;
});

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
      // رقم قصير ثابت بدل المعرّف الطويل: النموذج ينسخه بدقة أعلى
      const parts = [String(catalogNumber(p.id)), `[${productType(p)}]`, p.name];
      if (p.active && !p.name.includes(p.active)) parts.push(p.active);
      return parts.join("|");
    })
    .join("\n");

  return catalogCache;
}

export function getProductById(id: unknown) {
  const key = String(id || "").trim();
  if (/^\d{1,4}$/.test(key)) return productByNumber(Number(key));
  return productById(key);
}

export function hydrateProductSuggestions(
  suggestions: Array<{ id?: string; reason?: string }> | undefined,
  max = 4,
  customerText = "",
  historyText = "",
): ProductCard[] {
  // نعتمد على رسالة العميل الحالية؛ السياق السابق فقط إذا الرسالة نفسها ما تحدد الحاجة
  const hasOwnNeed = /بذور|بذر|سماد|اسمده|أسمدة|تسميد|حشر|آف|مبيد|مرض|فطر|بياض|صراصير|نمل|بعوض|ذباب|بق|سوس|دود|المن|تربس|عنكب|فئران|اصفرار|طماطم|نخيل|خيار/i.test(customerText);
  if (!hasOwnNeed && historyText) customerText = `${customerText} ${historyText}`;
  const asksSeeds = /بذور|بذر|بذره|بذرة|شتل|seed/i.test(customerText);
  // نوع الحاجة من كلام العميل: لا نخلط سماد بمبيد أو بذور
  const asksFertilizer = /سماد|اسمده|أسمدة|تسميد|تغذي|نقص عنصر|اصفرار|NPK|fertili[sz]/i.test(customerText);
  const asksPestOrDisease = /حشر|آف|افه|افات|مبيد|مرض|أمراض|فطر|عفن|بياض|تبقع|صراصير|نمل|بعوض|ذباب|بق|سوس|دود|حشرة المن|تربس|عنكب|فئران|pest|insect|disease|fung/i.test(customerText);
  const seen = new Set<string>();
  const cards: ProductCard[] = [];
  const nText = normalize(customerText);

  // زراعي أو منزلي؟ لا نرشح مبيد صحة عامة لمحصول، ولا مبيد زراعي لصراصير البيت
  const isAgri = AGRI_RE.test(nText);
  const isHome = HOME_RE.test(nText);
  // الآفات المذكورة بالاسم: نرشح فقط المنتجات المسجلة/المصنفة لها
  const pestKeys = PEST_KEYS.filter((k) => k.re.test(nText));
  const asksWeeds = /حشائش|اعشاب ضاره|الاعشاب|اعشاب|عشب ضار|نجيل ضار|سعد|weed|herbicid/.test(nText) && !/مبيد اعشاب طبيعي/.test(nText);
  const asksInsect = /حشر|المن|تربس|ذباب|بعوض|صرصور|صراصير|نمل|بق|سوس|دود|يرق|عنكب|اكاروس|حلم|صانعات|قشري|دوباس|حفار|جراد|نطاط|insect|aphid|thrips|mite/.test(nText);
  const asksFungal = /فطر|بياض|عفن|لفحه|تبقع|صدا|ذبول|تعفن|fung|mildew|blight|rot/.test(nText);

  const allowed = (product: StoreProduct) => {
    const type = productType(product);
    if (type === "بذور" && !asksSeeds) return false;
    if (asksFertilizer && !asksPestOrDisease && type !== "سماد") return false;
    if (asksPestOrDisease && !asksFertilizer && type === "سماد") return false;
    if (isAgri && !isHome && type === "مبيد صحة عامة") return false;
    if (isHome && !isAgri && (type === "مبيد زراعي" || type === "مبيد فطري" || type === "مبيد أعشاب")) return false;
    if (asksWeeds && !asksSeeds && type !== "مبيد أعشاب") return false;
    // حشرة ← لا مبيد فطري ولا أعشاب؛ مرض فطري ← لا مبيد حشري
    if (asksInsect && !asksFungal && (type === "مبيد فطري" || type === "مبيد أعشاب")) return false;
    if (asksFungal && !asksInsect && (type === "مبيد صحة عامة" || type === "قوارض" || type === "مصائد" || /حشري|الحشرات/.test(normalize(product.name)))) return false;
    if (pestKeys.length) {
      const hay = normalize([product.name, ...(product.categories || []), ...(product.targets || [])].join(" "));
      if (!pestKeys.some((k) => k.hay.some((h) => hay.includes(h)))) return false;
    }
    return true;
  };

  const seenNames = new Set<string>();
  for (const item of suggestions || []) {
    const product = getProductById(item?.id);
    if (!product || seen.has(product.id) || seenNames.has(normalize(product.name))) continue;
    if (!allowed(product)) continue;
    seen.add(product.id);
    seenNames.add(normalize(product.name));

    cards.push({
      id: product.id,
      name: product.name,
      url: product.url,
      image: product.image,
      size: product.size,
      active: activeOf(product),
      reason: String(item?.reason || "").slice(0, 160),
    });

    if (cards.length >= max) break;
  }

  // لو النموذج ما رشح منتجات مطابقة للآفة المذكورة، نكمل من الكتالوج مباشرة
  if (pestKeys.length && cards.length < 2) {
    for (const product of products) {
      if (cards.length >= Math.min(3, max)) break;
      if (seen.has(product.id) || seenNames.has(normalize(product.name)) || !allowed(product)) continue;
      seen.add(product.id);
      seenNames.add(normalize(product.name));
      cards.push({
        id: product.id,
        name: product.name,
        url: product.url,
        image: product.image,
        size: product.size,
        active: activeOf(product),
        reason: "",
      });
    }
  }

  return cards;
}

const AGRI_RE = /طماطم|بندوره|خيار|كوسا|باذنجان|فلفل|بطاطس|بصل|ثوم|ملفوف|كرنب|خس|بطيخ|شمام|فراوله|نخيل|نخله|نخل|تمر|ليمون|برتقال|حمضيات|مانجو|عنب|تين|رمان|زيتون|تفاح|خوخ|مشمش|قمح|ذره|شعير|برسيم|نجيل|ثيل|ورد|نبات|نباتات|شجر|اشجار|شجره|محصول|محاصيل|مزرع|حديقه|زرع|زراع|اوراق|ورق|ثمار|بيت محمي|صوب|المن|تربس|الذبابه البيضاء|عنكبوت|اكاروس|حلم|بق دقيقي|البق الدقيقي|قشري|صانعات|سوسه النخيل|حفار|دوباس|بياض|لفحه|تبقع|عفن/;
const HOME_RE = /صرصور|صراصير|بعوض|ناموس|ذباب منزلي|الذباب المنزلي|بق الفراش|بق الفراش|براغيث|قمل|نمل|رمه|النمل الابيض|عقارب|عقرب|حشرات زاحفه|حشرات طائره|منزل|بيت|البيت|مطبخ|غرفه|حمام|مستودع|مخزن/;

const PEST_KEYS: Array<{ re: RegExp; hay: string[] }> = [
  { re: /(^|\s)(لل|ال|وال|بال)?من(\s|$)|حشره المن|aphid/, hay: ["المن"] },
  { re: /تربس|thrips/, hay: ["تربس"] },
  { re: /ذبابه بيضاء|الذبابه البيضاء|ذباب ابيض|whitefl/, hay: ["الذبابه البيضاء", "ذباب ابيض"] },
  { re: /عنكبوت|اكاروس|حلم|mite/, hay: ["عنكب", "اكاروس", "حلم"] },
  { re: /بق دقيقي|البق الدقيقي|mealybug/, hay: ["البق الدقيقي", "بق دقيقي"] },
  { re: /قشري|قشريه|scale/, hay: ["قشري"] },
  { re: /صانعات|حفار الاوراق|leafminer/, hay: ["صانعات"] },
  { re: /سوسه النخيل|سوسة النخيل|weevil/, hay: ["سوسه"] },
  { re: /دوباس/, hay: ["دوباس"] },
  { re: /صرصور|صراصير|cockroach/, hay: ["صراصير", "صرصور"] },
  { re: /بعوض|ناموس|mosquito/, hay: ["بعوض"] },
  { re: /نمل ابيض|النمل الابيض|رمه|termite/, hay: ["رمه", "النمل الابيض"] },
  { re: /بق الفراش|bed ?bug/, hay: ["بق الفراش"] },
  { re: /فئران|فار|جرذ|جرذان|قوارض|rat|mice|mouse/, hay: ["فئران", "قوارض", "جرذ"] },
  { re: /بياض دقيقي|البياض الدقيقي|powdery/, hay: ["البياض الدقيقي", "بياض دقيقي"] },
  { re: /بياض زغبي|البياض الزغبي|downy/, hay: ["البياض الزغبي", "بياض زغبي"] },
];

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


/** المادة الفعالة: من الحقل، وإلا من الملخص "بالمادة الفعالة ..." */
export function activeOf(p: StoreProduct) {
  if (p.active) return `${p.active}${p.conc ? " " + p.conc : ""}`;
  const m = /بالمادة الفعالة\s+([^،,:.(]+)/.exec(p.summary || "");
  return m ? m[1].replace(/\s+(لمكافحة|عبوة|ل).*$/, "").trim() : "";
}

/** هيكل الحروف الساكنة: يوحّد إيميداكلوبرايد / إميداكلوبريد / أميداكلوبرايد */
function skel(v: string) {
  return normalize(v).replace(/^(وال|بال|لل|ال)/, "").replace(/[اويىهءئؤعة\s\d.%()+\-–/]/g, "").replace(/(.)\1+/g, "$1");
}

let activeSkelCache: Array<{ name: string; sk: string }> | null = null;
function knownActives() {
  if (activeSkelCache) return activeSkelCache;
  const map = new Map<string, string>();
  for (const p of products) {
    for (const part of activeOf(p).split(/\+|،|,|\sو(?=\S)| و /)) {
      const name = part.replace(/[\d.]+\s*%.*$/, "").replace(/\(.*$/, "").trim();
      const sk = skel(name);
      if (sk.length >= 4 && !map.has(sk)) map.set(sk, name);
    }
  }
  activeSkelCache = [...map].map(([sk, name]) => ({ sk, name }));
  return activeSkelCache;
}

/**
 * يمنع التناقض بين النصيحة والمنتجات: لو النصيحة ذكرت مادة فعالة ليست في المنتجات المقترحة،
 * نستبدل السطر بالمواد الفعالة الفعلية للمنتجات (أو نحذفه إذا ما عندنا مادتها).
 */
export function alignAdviceWithProducts(advice: unknown, cards: ProductCard[], lang: "ar" | "en" = "ar") {
  if (!Array.isArray(advice) || !cards.length) return advice;
  const cardSk = skel(cards.map((c) => `${c.name} ${c.active}`).join(" "));
  const actives: string[] = [];
  const seenSk = new Set<string>();
  for (const c of cards) {
    for (const part of c.active.split(/\+|،|,|\sو(?=\S)| و /)) {
      const name = part.replace(/[\d.]+\s*%.*$/, "").replace(/\(.*$/, "").trim();
      const sk = skel(name);
      if (sk.length >= 4 && !seenSk.has(sk)) { seenSk.add(sk); actives.push(name); }
    }
  }
  const names = knownActives();
  let replaced = false;
  const out: string[] = [];
  for (const line of advice as string[]) {
    const words = String(line || "").split(/[\s،,.؛:]+/).map(skel).filter((w) => w.length >= 4);
    const mentioned = names.filter((a) => words.some((w) => w === a.sk || (a.sk.length >= 5 && w.includes(a.sk))));
    const wrong = mentioned.some((a) => !cardSk.includes(a.sk));
    if (wrong) {
      if (!replaced && actives.length) {
        out.push(lang === "ar" ? `المادة الفعالة في المنتجات المقترحة: ${actives.slice(0, 3).join("، ")}.` : `Active ingredients of the suggested products: ${actives.slice(0, 3).join(", ")}.`);
        replaced = true;
      }
      continue;
    }
    out.push(line);
  }
  return out;
}


/* ---------- التعرف على اسم المنتج رغم اختلاف الكتابة (همزات، تاء مربوطة، حرف ناقص) ---------- */
function looseAr(v: string) {
  return normalize(v)
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/ء/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/[^ء-يa-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_WORDS = new Set(
  "مبيد مبيدات حشري فطري عشبي سماد اسمده بذور بذره جل طعم طعوم سائل بوده بودره محبب حبيبات مركز معلق قابل للبلل للذوبان صحه عامه زراعي لمكافحه مكافحه الصراصير صراصير النمل نمل البعوض الذباب بق الفراش الفيران فيران قوارض لتر مل جم جرام كيلو كجم عبوه حجم ضد علي من مع في او و دبليو بي اس سي اي سي جي ار ام ال للاستخدام المنزلي منزلي ابيض الابيض الاوراق التربه النبات عضوي متوازن مركب عناصر صغري كبري".split(" "),
);

function lev(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/** الكلمات المميزة لاسم المنتج (الاسم التجاري غالباً) */
function brandTokens(p: StoreProduct) {
  const ok = (w: string) => w.length >= 4 && !/^\d/.test(w) && !GENERIC_WORDS.has(w) && !GENERIC_WORDS.has("ال" + w);
  // الاسم التجاري = أول كلمة مميزة في اسم المنتج (أكوكيم، لورد…) + حقل العلامة إن وجد
  const first = looseAr(p.name).split(" ").map((w) => w.replace(/^ال/, "")).find(ok);
  const brand = looseAr(p.brand || "").split(" ").map((w) => w.replace(/^ال/, "")).filter(ok);
  return Array.from(new Set([first, ...brand].filter(Boolean) as string[])).slice(0, 3);
}

/**
 * يرجع منتجات المتجر اللي ذكرها العميل بالاسم، حتى لو كتبها بدون همزة
 * أو بحرف ناقص/زائد (مثل «اكوكيم» = «أكوكيم»، «فيبرونيل» = «فبرونيل»).
 */
export function findMentionedProducts(text: string, limit = 3): StoreProduct[] {
  const msgWords = looseAr(text)
    .split(" ")
    .map((w) => w.replace(/^(وال|بال|لل|ال|و|ب)(?=.{4,})/, ""))
    .filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
  if (!msgWords.length) return [];
  const hits: Array<{ p: StoreProduct; score: number }> = [];
  for (const p of products) {
    let score = 0;
    for (const t of brandTokens(p)) {
      for (const w of msgWords) {
        if (w === t) score += 10;
        else {
          const max = t.length >= 7 ? 2 : 1;
          if (lev(w, t, max) <= max) score += 6;
        }
      }
    }
    if (score > 0) hits.push({ p, score });
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => h.p);
}

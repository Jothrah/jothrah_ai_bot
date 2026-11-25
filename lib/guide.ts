import pesticidesData from "@/data/knowledge/guide/pesticides.json";
import listsData from "@/data/knowledge/guide/lists.json";
import fertRegData from "@/data/knowledge/guide/fertilizer-registration.json";
import { catalogProducts, catalogNumber, onCatalogChange } from "@/lib/catalog";

/**
 * معرفة جذرة الموسعة:
 * - دليل المبيدات الزراعية في المملكة العربية السعودية 1446 (المادة الفعالة، النوع، المجموعة، فترة الدخول، المحاصيل والآفات المسجلة)
 * - قائمة المبيدات المقيدة والمحظورة من نفس الدليل
 * - متطلبات تسجيل الأسمدة ومحسنات التربة (وزارة البيئة والمياه والزراعة / الشركة الوطنية للخدمات الزراعية)
 */

type GuideUse = { crops: string; pests: string; rate?: string; phi?: string };
type GuideEntry = {
  page?: number;
  ai_en: string;
  ai_ar: string;
  type: string;
  moa: string;
  chem_group: string;
  formulation: string;
  rei: string;
  restricted: string;
  props: string;
  uses: GuideUse[];
};
type ListItem = { name: string; cas: string; use: string; restriction?: string };

const guide = pesticidesData as GuideEntry[];
const lists = listsData as { restricted: ListItem[]; banned: ListItem[] };

function norm(v: string) {
  return String(v || "")
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "في من على عن الى الي مع او و هل وش ايش كيف متى ليش لماذا ما هو هي عندي عندنا ابي ابغى ابغي ابى اريد احتاج نبي مبيد مبيدات افضل احسن شي شيء حق حقي لل ال يا لو اذا لكن بس كم سعر انا اللي الي هذا هذه ذا".split(" "),
);

function tokens(text: string) {
  return norm(text)
    .split(" ")
    .map((w) => w.replace(/^(وال|بال|لل|ال|و)/, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

/** هيكل صوتي مشترك للعربي واللاتيني: يطابق "الكلوربيريفوس" مع Chlorpyrifos. */
function skel(word: string) {
  let w = String(word || "").toLowerCase();
  if (/[a-z]/.test(w)) {
    w = w
      .replace(/c(?=[eiy])/g, "s").replace(/ph/g, "f").replace(/th/g, "t").replace(/ch/g, "k").replace(/sh/g, "s").replace(/kh/g, "k")
      .replace(/[cq]/g, "k").replace(/p/g, "b").replace(/v/g, "f").replace(/x/g, "ks").replace(/g/g, "j")
      .replace(/[^a-z]/g, "").replace(/[aeiouywh]/g, "");
  } else {
    w = w.replace(/^(وال|بال|لل|ال)/, "");
    const map: Record<string, string> = { "ك": "k", "ق": "k", "خ": "k", "ل": "l", "ر": "r", "ب": "b", "ف": "f", "س": "s", "ص": "s", "ث": "s", "ش": "s", "ت": "t", "ط": "t", "د": "d", "ض": "d", "ذ": "z", "ز": "z", "ظ": "z", "ج": "j", "غ": "j", "م": "m", "ن": "n" };
    w = [...w].map((c) => map[c] ?? "").join("");
  }
  return w.replace(/(.)\1+/g, "$1");
}
function skelHit(textSkels: string[], name: string) {
  const k = skel(norm(name).split(/[\s(\[\d%-]/)[0]);
  if (k.length < 5) return false;
  return textSkels.some((t) => t.length >= 5 && (t === k || (t.length >= 6 && (k.startsWith(t) || t.startsWith(k)))));
}
function textSkels(text: string) {
  return String(text || "").split(/[\s،,.؟?!]+/).filter((w) => w.length >= 4).map(skel);
}

const indexed = guide.map((e) => ({
  e,
  hayUses: norm(e.uses.map((u) => `${u.crops} ${u.pests}`).join(" ")),
  hayRows: e.uses.map((u) => norm(`${u.crops} ${u.pests}`)),
  hayName: norm(`${e.ai_en} ${e.ai_ar} ${e.chem_group}`),
  hayType: norm(`${e.type} ${e.props}`),
}));

/* ربط منتجات المتجر بالدليل: اسم المنتج (أكوكيم، لورد...) ← مادته الفعالة وتركيزه وهيئته */
type StoreP = { id: string; name: string; active: string; conc: string; summary: string };
const GENERIC = new Set(["سماد", "مبيد", "بذور", "مصيده", "مصيدة", "طعم", "جهاز", "مرشه", "مرشة", "شبك", "اسمده", "منشط", "محلول", "مركب"]);
const FORM_MAP: Array<[RegExp, string]> = [
  [/دبليو دي جي|\bwdg\b|\bdf\b/i, "WG"], [/اي سي|\bec\b/i, "EC"], [/اس سي|\bsc\b/i, "SC"], [/دبليو بي|\bwp\b/i, "WP"], [/دبليو جي|\bwg\b/i, "WG"],
  [/اس ال|\bsl\b/i, "SL"], [/اس بي|\bsp\b/i, "SP"], [/اي دبليو|\bew\b/i, "EW"], [/جي ار|\bgr\b/i, "GR"],
  [/ام اي|\bme\b/i, "ME"], [/او دي|\bod\b/i, "OD"], [/سي اس|\bcs\b/i, "CS"], [/اف اس|\bfs\b/i, "FS"],
  [/زد سي|\bzc\b/i, "ZC"], [/اس اي|\bse\b/i, "SE"], [/اس جي|\bsg\b/i, "SG"], [/دبليو اس|\bws\b/i, "WS"],
];
function formCode(v: string) {
  const n = norm(v);
  for (const [re, c] of FORM_MAP) if (re.test(n)) return c;
  return "";
}
/** التركيز: من الاسم (%)، أو من المادة الفعالة، أو رقم جم/لتر قبل الهيئة (50 إي سي = 5%) */
function productPct(name: string, active: string) {
  const a = /(\d+(?:\.\d+)?)\s*%/.exec(name) || /(\d+(?:\.\d+)?)\s*%/.exec(active);
  if (a) return a[1];
  const n = String(name || "").replace(/[إأآ]/g, "ا");
  const g = /(\d+(?:\.\d+)?)\s+(اي سي|اس سي|اي دبليو|دبليو|اس ال|اس بي|جي ار|جي آر|ام اي|او دي|سي اس|اس اي|اس جي)/.exec(n);
  if (g) {
    // الهيئات الصلبة يكتب رقمها كنسبة مئوية، والسائلة جم/لتر (50 إي سي = 5%)
    const solid = /^(دبليو|اس بي|جي ار|جي آر|اس جي)$/.test(g[2]) && !/اي دبليو/.test(g[0]);
    return String(solid ? Number(g[1]) : Number(g[1]) / 10);
  }
  return "";
}
function storeActive(p: StoreP) {
  if (p.active) return p.active;
  const m = /بالمادة الفعالة\s+([^،,:.(]+)/.exec(p.summary || "");
  return m ? m[1].replace(/\s+(لمكافحة|عبوة|ل).*$/, "").trim() : "";
}
function buildStoreIndex() {
  return (catalogProducts() as StoreP[])
    .map((p) => {
      const first = norm(p.name).split(" ")[0] || "";
      const active = storeActive(p);
      return { p, brand: GENERIC.has(first) || first.length < 3 ? "" : first, active, form: formCode(p.name), pct: productPct(p.name, active) };
    })
    .filter((x) => x.brand && x.active);
}
// يُعاد بناؤه تلقائياً كلما تحدث كتالوج المتجر من سلة
let storeIndex = buildStoreIndex();

/** مستوى تطابق منتج متجر مع صفحة في الدليل: 2 = نفس المادة والتركيز والهيئة، 1 = نفس المادة فقط، 0 = لا */
function productMatch(x: { active: string; form: string; pct: string }, e: GuideEntry) {
  const aSk = x.active.split(/\+|،|,|\sو(?=\S)| و /).map((a) => skel(a.replace(/[\d.]+\s*%.*$/, ""))).filter((k) => k.length >= 4);
  const eSk = entrySkels(e);
  if (!aSk.length || aSk.length !== eSk.length) return 0;
  if (!aSk.every((a) => eSk.some((k) => k === a || k.includes(a) || a.includes(k)))) return 0;
  const formOk = !!x.form && e.ai_en.toUpperCase().replace(/\s+/g, "").includes(x.form);
  const ePcts = [...e.ai_en.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  const pv = Number(x.pct);
  const pctOk = !!x.pct && (ePcts.some((v) => Math.abs(v - pv) < 0.05) || (ePcts.length > 1 && Math.abs(ePcts.reduce((a, b) => a + b, 0) - pv) < 0.2));
  return formOk && pctOk ? 2 : 1;
}

/** رقم المنتج في كتالوج البوت (نفس ترقيم buildCatalogIndex). */
const catalogNo = { get: (p: StoreP) => catalogNumber(p.id) };
const storeMatchCache = new Map<GuideEntry, typeof storeIndex>();
onCatalogChange(() => {
  storeIndex = buildStoreIndex();
  storeMatchCache.clear();
});
/** منتجات المتجر المطابقة تماماً لصفحة الدليل (نفس المادة والتركيز والهيئة). */
function storeMatchesFor(e: GuideEntry) {
  let hit = storeMatchCache.get(e);
  if (!hit) {
    const seen = new Set<string>();
    hit = storeIndex.filter((x) => {
      if (productMatch(x, e) !== 2 || seen.has(x.brand)) return false;
      seen.add(x.brand);
      return true;
    });
    storeMatchCache.set(e, hit);
  }
  return hit;
}

/** منتجات المتجر المذكورة في السؤال (بالاسم التجاري). */
export function mentionedStoreProducts(text: string) {
  const n = ` ${norm(text)} `;
  const seen = new Set<string>();
  return storeIndex.filter((x) => {
    if (seen.has(x.brand)) return false;
    // يقبل حروف الجر والعطف الملتصقة بالاسم: لأكوكيم، بلورد، وأكوكيم، للورد، بالأكوكيم
    const esc = x.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hit = new RegExp(`\\s(?:[وفبلك])?(?:ال|لل)?${esc}`).test(n);
    if (hit) seen.add(x.brand);
    return hit;
  }).slice(0, 2);
}

function entrySkels(e: GuideEntry) {
  return e.ai_en.split(/\+|,/).map((part) => skel(part.replace(/[\d.]+\s*%.*$/, "").replace(/\(.*$/, ""))).filter((k) => k.length >= 4);
}

/** أفضل مواد فعالة من الدليل تطابق كلام العميل (محصول/آفة/اسم مادة). */
const PEST_RE = /حشر|آف|افه|افات|مبيد|مرض|أمراض|فطر|عفن|بياض|تبقع|لفح|صراصير|نمل|بعوض|ذباب|بق|سوس|دود|حشرة المن|تربس|عنكب|اكاروس|أكاروس|فئران|قوارض|حشائش|أعشاب|نيماتود|قواقع|pest|insect|disease|fung|weed/i;

export function searchGuide(text: string, limit = 6) {
  const prods = mentionedStoreProducts(text);
  if (FERT_RE.test(text) && !PEST_RE.test(text) && !prods.length) return [];
  const toks = tokens(text);
  if (!toks.length && !prods.length) return [];
  // منتج متجر مذكور بالاسم: نطابق مادته الفعالة + التركيز + الهيئة مع صفحة الدليل
  const prodBoost = (e: GuideEntry) => {
    let b = 0;
    for (const x of prods) {
      const m = productMatch(x, e);
      if (m) b = Math.max(b, m === 2 ? 32 : 20);
    }
    return b;
  };
  const sk = textSkels(text);
  const nt = ` ${norm(text)} `;
  const shortPests = [
    /\s(لل|ال|وال|بال)من\s/.test(nt) || /\s(عندي|فيه|في|عليه|عليها|عليهم|حشره|حشرة)\s+من\s/.test(nt) || /\sمن\s+(على|علي|في|ب\S+)\s/.test(nt) ? "المن" : "",
    /\s(لل|ال|ل|و)?بق\s/.test(nt) ? "البق" : "",
  ].filter(Boolean);
  return indexed
    .map((x) => {
      const hitName = skelHit(sk, x.e.ai_en);
      let score = (hitName ? 8 + (x.e.ai_en.includes("+") ? 0 : 2) : 0) + (prods.length ? prodBoost(x.e) : 0);
      for (const sp of shortPests) if (x.hayUses.includes(sp)) score += 5;
      for (const t of toks) {
        if (x.hayName.includes(t)) score += 6;
        if (x.hayUses.includes(t)) score += 3;
        if (x.hayType.includes(t)) score += 1;
      }
      // صف واحد يجمع محصول السؤال وآفته أهم من تطابقات متفرقة في صفوف مختلفة
      const rowBest = Math.max(0, ...x.hayRows.map((r) => toks.filter((t) => r.includes(t)).length + shortPests.filter((sp) => r.includes(sp)).length));
      if (rowBest >= 2) score += 4 + 2 * (rowBest - 2);
      // بدون منتج مذكور: نقدّم المواد المتوفرة في المتجر بنفس التركيز والهيئة
      if (!prods.length && score >= 3 && storeMatchesFor(x.e).length) score += 3;
      return { e: x.e, score };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

/** خانة "فترة التحريم" في الدليل أحياناً تحمل تعليمات تطبيق لا مدة قبل الحصاد (تغطيس الفسائل، التهوية بعد التبخير...). */
const PHI_NOTE_RE = /تغرس|التهوي|يستخدم|آمن عند|لا تستعمل|قبل البذر|حسب فترة|تجنب الرعي/;

export function formatGuideEntries(entries: GuideEntry[], text = "") {
  const qt = tokens(text);
  const prods = mentionedStoreProducts(text);
  return entries
    .map((e) => {
      // نعرض أولاً الصفوف المطابقة لمحصول/آفة السؤال
      const scored = e.uses.map((u) => {
        const hay = norm(`${u.crops} ${u.pests}`);
        return { u, s: qt.filter((t) => hay.includes(t)).length };
      });
      const best = scored.some((x) => x.s > 0) ? scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s) : scored;
      const uses = best
        .slice(0, 5)
        .map(({ u }) => `  - ${u.crops} ← ${u.pests}${u.rate ? ` | المعدل: ${u.rate}` : ""}${u.phi ? (PHI_NOTE_RE.test(u.phi) ? ` | ملاحظة تطبيق (ليست فترة تحريم — انقلها كما هي): ${u.phi}` : ` | فترة التحريم (ما قبل الحصاد): ${u.phi}`) : ""}`)
        .join("\n");
      return [
        `• ${e.ai_en}${e.type ? ` — ${e.type}` : ""}`,
        e.moa && !/%/.test(e.chem_group || "") ? `  المجموعة الكيميائية: ${e.chem_group || "-"} | مجموعة المقاومة: ${e.moa}` : "",
        e.rei || e.restricted ? `  فترة عودة الدخول: ${e.rei || "-"} | استخدام مقيد: ${e.restricted || "-"}` : "",
        e.props ? `  خواص: ${e.props}` : "",
        ...prods.map((x) => {
          const m = productMatch(x, e);
          if (m === 2) return `  ✅ هذه الصفحة مطابقة لمنتج المتجر «${x.p.name}» (نفس المادة الفعالة والتركيز والهيئة) — استخدم معدلاتها لهذا المنتج.`;
          if (m === 1) return `  ⚠️ نفس المادة الفعالة لمنتج «${x.p.name}» لكن بتركيز أو هيئة مختلفة — لا تعطِ هذه المعدلات لذلك المنتج.`;
          return "";
        }),
        !prods.length && storeMatchesFor(e).length
          ? `  🛒 متوفر في المتجر بنفس المادة والتركيز والهيئة: ${storeMatchesFor(e).slice(0, 2).map((x) => `«${x.p.name}» (رقم الكتالوج ${catalogNo.get(x.p)}، المادة بالعربي: ${x.active})`).join("، ")}`
          : "",
        uses ? `  الاستخدامات المسجلة في الدليل (المحصول ← الآفة | المعدل | فترة التحريم):\n${uses}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

const LEGAL_RE = /محظور|ممنوع|مقيد|مسموح|مسجل|غير مسجل|مخالف|قانوني|banned|restricted|prohibited|legal/i;

/** المبيدات المقيدة والمحظورة: تُرسل للنموذج عند السؤال عن الحظر/التقييد أو عند ذكر مادة موجودة في القوائم. */
export function listsContext(text: string) {
  const n = norm(text);
  const sk = textSkels(text);
  const hit = (item: ListItem) => {
    const first = norm(item.name).split(/[\s(\[]/)[0];
    return (first.length >= 4 && n.includes(first)) || skelHit(sk, item.name);
  };
  const r = lists.restricted.filter(hit);
  const b = lists.banned.filter(hit);
  const asksLegal = LEGAL_RE.test(text);
  if (!asksLegal && !r.length && !b.length) return "";

  const parts: string[] = [];
  if (r.length || b.length) {
    parts.push(
      "الحكم الصحيح (مطابق من القوائم، اعتمده حرفياً): " +
        [...r.map((x) => `${x.name} = مقيد وليس محظوراً`), ...b.map((x) => `${x.name} = محظور`)].join("؛ "),
    );
    if (r.length) parts.push("مواد مذكورة في قائمة المبيدات المقيدة:\n" + r.map((x) => `- ${x.name} (${x.use}): ${x.restriction || "استخدام مقيد بموافقة وإشراف السلطة المختصة"}`).join("\n"));
    if (b.length) parts.push("مواد مذكورة في قائمة المبيدات المحظورة في المملكة:\n" + b.map((x) => `- ${x.name} (${x.use})`).join("\n"));
  }
  if (asksLegal) {
    parts.push(
      `قائمة المبيدات المقيدة (${lists.restricted.length} مادة، تُستخدم فقط بموافقة وإشراف السلطة المختصة):\n` +
        lists.restricted.map((x) => `${x.name}${x.restriction ? ` — ${x.restriction}` : ""}`).join("\n"),
    );
    parts.push(`قائمة المبيدات المحظورة في المملكة (${lists.banned.length} مادة):\n` + lists.banned.map((x) => x.name).join("، "));
  }
  return parts.join("\n\n");
}

const FERT_REG_RE = /تسجيل\s*(ال)?(سماد|اسمده|أسمدة|الأسمدة|محسن)|اعاده تسجيل|إعادة تسجيل|منصه نما|منصة نما|استيراد\s*(ال)?(سماد|اسمده|أسمدة)|ملصق\s*(ال)?سماد|العناصر الثقيله|العناصر الثقيلة|العناصر المشعه|العناصر المشعة|iso\s*17025|msds|tds|fertili[sz]er registration/i;
/** متطلبات تسجيل الأسمدة ومحسنات التربة (للتجار والمستوردين والمصانع). */
export function fertilizerRegistrationContext(text: string) {
  if (!FERT_REG_RE.test(text)) return "";
  const d = fertRegData as { checklist: string; doc: string };
  return `${d.checklist}\n\n--- وثيقة متطلبات تسجيل وإعادة تسجيل الأسمدة ومحسنات التربة (نص مستخرج) ---\n${d.doc}`.slice(0, 30000);
}

/* ------------------------------------------------------------------ */
/* معرفة الأسمدة (ملفات جذرة الداخلية) — تُختار حسب سؤال العميل          */
/* ------------------------------------------------------------------ */
import fOps from "@/app/data/knowledge/fertilizers/00_fertilizer_operating_rules.json";
import fLimits from "@/app/data/knowledge/fertilizers/fertilizer_compliance_limits.json";
import fDiag from "@/app/data/knowledge/fertilizers/fertilizer_diagnosis_general.json";
import fYellow from "@/app/data/knowledge/fertilizers/fertilizer_diagnosis_yellowing.json";
import fLabel from "@/app/data/knowledge/fertilizers/fertilizer_label_reading.json";
import fMix from "@/app/data/knowledge/fertilizers/fertilizer_mixing_rules.json";
import fHumic from "@/app/data/knowledge/fertilizers/fertilizer_rates_humic_fulvic_amino_seaweed.json";
import fMicro from "@/app/data/knowledge/fertilizers/fertilizer_rates_micronutrients.json";
import fNpk from "@/app/data/knowledge/fertilizers/fertilizer_rates_npk.json";
import fSingle from "@/app/data/knowledge/fertilizers/fertilizer_rates_single_fertilizers.json";
import fSoil from "@/app/data/knowledge/fertilizers/fertilizer_rates_soil_amendments.json";
import fHandoff from "@/app/data/knowledge/fertilizers/fertilizer_specialist_handoff.json";

const FERT_RE = /سماد|اسمده|أسمدة|تسميد|تغذي|عنصر|عناصر|اصفرار|NPK|نيتروجين|فوسفور|بوتاس|كالسيوم|مغنيسيوم|حديد|زنك|بورون|هيوميك|فولفيك|أحماض أمينية|احماض امينيه|طحالب|يوريا|جبس|كبريت|تربه|تربة|fertili[sz]/i;

function arPart(x: unknown) {
  const o = x as Record<string, unknown>;
  return JSON.stringify(o?.ar ?? o).replace(/\s+/g, " ");
}

export function fertilizerKnowledgeContext(text: string) {
  if (!FERT_RE.test(text)) return "";
  const t = text;
  const files: unknown[] = [fOps, fDiag];
  if (/اصفر|اصفرار|yellow/i.test(t)) files.push(fYellow);
  if (/خلط|يخلط|مخلوط|mix/i.test(t)) files.push(fMix);
  if (/ملصق|label/i.test(t)) files.push(fLabel);
  if (/حدود|ثقيل|مشع|limit/i.test(t)) files.push(fLimits);
  if (/هيوميك|فولفيك|امينيه|أمينية|طحالب|humic|amino|seaweed/i.test(t)) files.push(fHumic);
  if (/حديد|زنك|منجنيز|بورون|نحاس|مولبيدنم|صغرى|مخلبي/i.test(t)) files.push(fMicro);
  if (/يوريا|سلفات|نترات|فوسفات|single/i.test(t)) files.push(fSingle);
  if (/جبس|كبريت زراعي|محسن|ملوحه|ملوحة|تربه|تربة/i.test(t)) files.push(fSoil);
  if (/معدل|كميه|كمية|كم |جرام|غرام|لتر|مل |npk|\d+-\d+-\d+/i.test(t) || files.length <= 2) files.push(fNpk);
  files.push(fHandoff);
  return files.map(arPart).join("\n").slice(0, 14000);
}

/* تحديد فئة المحصول وإعطاء المعدل الصحيح من ملف NPK مباشرة (حتى لا يخلط النموذج بين الصفوف) */
const CROP_CATS: Array<{ key: string; re: RegExp }> = [
  { key: "بيوت محمية", re: /بيو?ت (ال)?محمي|صوب|صوبه|صوبة|greenhouse/i },
  { key: "محاصيل خضار", re: /طماطم|بندوره|خيار|فلفل|باذنجان|كوسا|كوسه|بطاطس|بطاطا|بصل|ثوم|ملفوف|كرنب|خس|بطيخ|شمام|فراوله|فراولة|بامي|بامية|جزر|قرنبيط|بروكلي|خضار|خضروات/i },
  { key: "محاصيل فاكهة", re: /نخيل|نخله|نخلة|نخل|تمر|ليمون|برتقال|حمضيات|يوسفي|عنب|مانجو|تين|رمان|زيتون|تفاح|خوخ|مشمش|جوافه|جوافة|موز|فاكهه|فاكهة|اشجار مثمره|أشجار مثمرة/i },
  { key: "محاصيل حقلية", re: /قمح|شعير|ذره|ذرة|برسيم|اعلاف|أعلاف|رودس|سورجم|دخن/i },
  { key: "نباتات زينة", re: /زينه|زينة|ورد|نجيل|ثيل|عشب الحديقه|عشب الحديقة|اشجار الزينه|أشجار الزينة/i },
];

export function fertilizerRateHint(text: string) {
  if (!FERT_RE.test(text)) return "";
  if (!/معدل|كميه|كمية|كم |جرام|غرام|كيلو|كجم|لتر|مل |npk|\d+-\d+-\d+|متوازن|مركب/i.test(text)) return "";
  const cat = CROP_CATS.find((c) => c.re.test(text));
  if (!cat) return "";
  const npk = (fNpk as any)?.ar;
  if (!npk) return "";
  const solid = (npk.solid_npk_irrigation || []).find((r: any) => r.crop === cat.key)?.rate;
  const liquid = (npk.liquid_npk_irrigation || []).find((r: any) => r.crop === cat.key)?.rate;
  const short: Record<string, string> = { "محاصيل حقلية": "محاصيل حقلية", "محاصيل خضار": "خضار", "محاصيل فاكهة": "فاكهة", "بيوت محمية": "بيوت محمية", "نباتات زينة": "نباتات زينة" };
  const ex = String((npk.example_20_20_20_50m2 || [])[0] || "");
  const m = new RegExp(`${short[cat.key]}\\s+([\\d.]+-[\\d.]+\\s*جم)`).exec(ex);
  return [
    `فئة المحصول في السؤال: ${cat.key} (اعتمد هذه الفئة فقط ولا تستخدم صفوف الفئات الأخرى).`,
    solid ? `سماد NPK صلب ذواب مع ماء الري: ${solid}.` : "",
    liquid ? `سماد NPK سائل مع ماء الري: ${liquid}.` : "",
    npk.solid_npk_foliar ? `رش ورقي (صلب): ${npk.solid_npk_foliar}.` : "",
    m ? `مثال لمساحة 50 م² مع ماء الري: ${m[1]}.` : "",
    `ملاحظة إلزامية: ${npk.mandatory_note}`,
  ].filter(Boolean).join("\n");
}

/* ───────── توصية مباشرة: "عندي <آفة> على <محصول> وش أستخدم" بدون ذكر منتج ─────────
 * نختار من الدليل صفاً يجمع آفة السؤال ومحصوله، وله منتج في المتجر بنفس المادة والتركيز والهيئة،
 * ونكتب الرد بصيغة ثابتة (المادة + المنتج + المعدل + فترة التحريم) بدون الاعتماد على صياغة النموذج. */
const PEST_HAY = ` ${norm(guide.flatMap((e) => e.uses.map((u) => u.pests)).join(" ")).split(" ").map((w) => w.replace(/^(وال|بال|لل|ال)/, "")).join(" ")} `;
const NOT_RECO_RE = /اعراض|أعراض|سبب|أسباب|اسباب|ليش|لماذا|تعريف|وش هو|وش هي|ما هو|ما هي|ايش هو|ايش هي|كيف اعرف|كيف أعرف|محظور|ممنوع|مقيد|مسجل|تسجيل|سعر|بكم|خلط|يخلط|نخلط/;
const NON_WORDS = new Set(["عندي", "عندنا", "على", "علي", "في", "وش", "ايش", "استخدم", "أستخدم", "الحل", "حل", "علاج", "اعالج", "أعالج", "ارش", "أرش", "مبيد", "يصلح", "ينفع", "شجر", "اشجار", "أشجار", "زرع", "زراعة", "مزرعة", "مزرعتي", "فيه", "فيها", "عليه", "عليها", "طلع", "ظهر", "ظهرت", "طلعت", "كثير", "مره", "مرة", "مرررره"]);

function wordsOf(text: string) {
  return String(text || "").split(/[\s،,.؟?!:]+/).map((w) => w.trim()).filter(Boolean);
}
const wKey = (w: string) => norm(w).replace(/^(وال|بال|لل|ال)/, "");

function activeAr(x: { active: string }) {
  // خليط: نكتب المادتين كاملتين بتركيزهما (بوسكاليد 25.2% + بيراكلوستروبين 12.8%)
  if (/\+/.test(x.active)) return x.active.replace(/\s*\((?:و\/[وح]|w\/[wv])\)\s*/gi, " ").replace(/\s+/g, " ").trim();
  return x.active.replace(/\s*[\d.]+\s*%.*$/, "").replace(/\s+و\/[وح].*$/, "").trim();
}
function brandAr(p: StoreP) {
  return String(p.name || "").split(/\s+/)[0] || p.name;
}
function phiLine(phi?: string) {
  const v = String(phi || "").trim();
  if (!v || /^[-—–]$/.test(v)) return "";
  if (PHI_NOTE_RE.test(v)) return v.endsWith(".") ? v : `${v}.`;
  return `فترة التحريم قبل الحصاد: ${v}`;
}

export type GuideRecommendation = { summary: string; advice: string[]; catalogNos: number[] };

export function recommendFromGuide(text: string): GuideRecommendation | null {
  const msg = String(text || "").trim();
  if (!msg || msg.length > 220 || NOT_RECO_RE.test(msg)) return null;
  if (mentionedStoreProducts(msg).length) return null;
  const nt = ` ${norm(msg)} `;
  const aphid = /\s(لل|ال|وال|بال)من\s/.test(nt) || /\s(عندي|فيه|في|عليه|عليها|عليهم|حشره|حشرة)\s+من\s/.test(nt) || /\sمن\s+(على|علي|في|ب\S+)\s/.test(nt);
  const words = wordsOf(msg);
  const keys = words.map((w) => (NON_WORDS.has(w) || NON_WORDS.has(norm(w)) || STOP.has(norm(w)) ? "" : wKey(w)));
  // كلمات الآفة في السؤال = أطول تتابع كلمات موجود في أسماء آفات الدليل (دودة ورق القطن، البياض الدقيقي، سوسة النخيل)
  const isPestWord = (k: string) => k.length >= 3 && PEST_HAY.includes(` ${k}`);
  let runS = -1, runE = -1;
  for (let i = 0; i < keys.length; i++) {
    if (!isPestWord(keys[i])) continue;
    let j = i;
    while (j + 1 < keys.length && isPestWord(keys[j + 1])) j++;
    if (runS < 0 || j - i > runE - runS) { runS = i; runE = j; }
    i = j;
  }
  const run = runS >= 0 ? keys.slice(runS, runE + 1) : [];
  if (!run.length && !aphid) return null;
  if (!run.length && !PEST_RE.test(msg) && !aphid) return null;
  const entries = searchGuide(msg, 6);

  type Cand = { e: GuideEntry; u: GuideUse; x: (typeof storeIndex)[number] | null; score: number; pestIdx: number[]; cropIdx: number[] };
  const collect = (withStore: boolean) => {
  const cands: Cand[] = [];
  entries.forEach((e, rank) => {
    const stores = storeMatchesFor(e);
    if (withStore ? !stores.length : stores.length) return;
    for (const u of e.uses) {
      const pn = norm(u.pests);
      const cn = norm(u.crops);
      // كل كلمات الآفة اللي ذكرها العميل لازم تكون في نفس الصف (دودة ورق القطن ≠ دودة ورق الكرنب)
      const runOk = run.length > 0 && run.every((k) => pn.includes(k));
      const pestIdx = runOk ? Array.from({ length: runE - runS + 1 }, (_, n) => runS + n) : [];
      const pestOk = runOk || (!run.length && aphid && pn.includes("المن")) || (aphid && pn.includes("المن") && run.every((k) => norm(u.crops).includes(k)));
      if (!pestOk) continue;
      const cropIdx = keys.map((k, i) => (k.length >= 3 && cn.includes(k) && !pestIdx.includes(i) ? i : -1)).filter((i) => i >= 0);
      // ذكر العميل محصولاً موجوداً في الدليل لكنه ليس في هذا الصف → الصف لا يناسب
      const askedCrop = keys.some((k, i) => k.length >= 3 && !pestIdx.includes(i) && guide.some((g) => g.uses.some((gu) => norm(gu.crops).includes(k))));
      if (askedCrop && !cropIdx.length && !keys.some((k) => k.length >= 3 && cn.includes(k))) continue;
      const score = pestIdx.length * 2 + (aphid ? 2 : 0) + cropIdx.length * 3 - rank * 0.5;
      cands.push({ e, u, x: stores[0] || null, score, pestIdx, cropIdx });
    }
  });
  return cands.sort((a, b) => b.score - a.score);
  };
  let cands = collect(true);
  const inStore = cands.length > 0;
  if (!inStore) cands = collect(false);
  if (!cands.length) return null;
  const best = cands[0];

  // الآفة والمحصول بكلمات العميل نفسها
  let pest = "";
  if (best.pestIdx.length) {
    const s = Math.min(...best.pestIdx);
    let eIdx = s;
    while (best.pestIdx.includes(eIdx + 1)) eIdx++;
    pest = words.slice(s, eIdx + 1).join(" ");
  } else if (aphid) pest = "المن";
  const crop = best.cropIdx.length ? words[best.cropIdx[0]] : "";
  const lam = (w: string) => (/^ال/.test(w) ? `لل${w.slice(2)}` : /\s/.test(w) ? `ل${w}` : `لل${w}`);
  const head = `${pest ? lam(pest) : "لهذه المشكلة"}${crop ? ` على ${crop}` : ""} تقدر تستخدم`;
  if (!best.x) {
    // المادة مسجلة لهذه الآفة والمحصول لكن ما عندنا منتج مطابق في المتجر
    const ai = best.e.ai_en.replace(/\(\s*w\s*[\\/]\s*[vw]\s*\)/gi, "").replace(/\s+/g, " ").trim();
    return {
      summary: `${head} مادة ${ai}.`,
      advice: [best.u.rate ? `المعدل: ${best.u.rate}` : "", phiLine(best.u.phi), "هذه المادة غير متوفرة حالياً في متجر جذرة.", "الالتزام بملصق المنتج."].filter(Boolean),
      catalogNos: [],
    };
  }
  const bx = best.x;
  const pct = bx.pct ? ` ${bx.pct}%` : "";
  const summary = `${head} ${activeAr(bx)}${pct} (${brandAr(bx.p)}).`;

  const advice = [best.u.rate ? `المعدل: ${best.u.rate}` : "", phiLine(best.u.phi), "الالتزام بملصق المنتج."].filter(Boolean);
  const catalogNos = [catalogNo.get(bx.p)!];

  // بديل بمادة فعالة مختلفة لنفس الآفة والمحصول
  const bestAi = skel(activeAr(bx));
  const alt = cands.find((c) => c !== best && c.x && c.score >= best.score - 3 && skel(activeAr(c.x)) !== bestAi && c.e.ai_en.split("+").length === 1);
  if (alt && alt.x) {
    const ap = alt.x.pct ? ` ${alt.x.pct}%` : "";
    const altPhi = phiLine(alt.u.phi);
    advice.splice(advice.length - 1, 0, `بديل: ${activeAr(alt.x)}${ap} (${brandAr(alt.x.p)}) — المعدل ${alt.u.rate || "حسب الملصق"}${altPhi ? `، ${altPhi.replace(/\.$/, "")}` : ""}.`);
    catalogNos.push(catalogNo.get(alt.x.p)!);
  }
  return { summary, advice, catalogNos };
}

/** أرقام الكتالوج للمنتجات المذكورة بالاسم في السؤال. */
export function mentionedCatalogNos(text: string) {
  return mentionedStoreProducts(text).map((x) => catalogNo.get(x.p)!).filter(Boolean);
}

/* ───────── سؤال معدل/تحريم لمنتج مذكور بالاسم (أكوكيم، لورد، بوستاك...) ─────────
 * نأخذ صفحة الدليل المطابقة تماماً للمنتج، ونختار صف محصول/آفة السؤال؛
 * إذا ما حدد المحصول وتختلف المعدلات أو فترات التحريم، نعرضها لكل مجموعة محاصيل. */
const RATE_Q_RE = /معدل|كم|جرعه|جرعة|نسبه|نسبة|مقدار|لكل لتر|للتر|باللتر|تحريم|قبل الحصاد|كيف استخدم|كيف أستخدم|طريقة استخدام|طريقه استخدام|استخدامه|اخلط|أخلط|احط|أحط/;

export function namedProductRate(text: string): (GuideRecommendation & { askCrop: boolean }) | null {
  const msg = String(text || "").trim();
  if (!msg || !RATE_Q_RE.test(msg) || /محظور|ممنوع|مقيد|تسجيل|سعر|بكم/.test(msg)) return null;
  const prods = mentionedStoreProducts(msg);
  if (prods.length !== 1) return null;
  const x = prods[0];
  const e = guide.find((g) => productMatch(x, g) === 2);
  if (!e || !e.uses.length) return null;
  const brand = brandAr(x.p);
  const bn = norm(brand);
  const keys = wordsOf(msg).map((w) => wKey(w)).filter((k) => k.length >= 3 && !STOP.has(k) && !NON_WORDS.has(k) && !bn.includes(k));
  const hit = e.uses.filter((u) => {
    const h = norm(`${u.crops} ${u.pests}`);
    return keys.some((k) => h.includes(k));
  });
  const rows = hit.length ? hit : e.uses;
  // نجمع الصفوف المتطابقة في المعدل وفترة التحريم
  const groups: { crops: string[]; rate: string; phi: string }[] = [];
  for (const u of rows) {
    const g = groups.find((v) => v.rate === (u.rate || "") && v.phi === (u.phi || ""));
    if (g) g.crops.push(u.crops);
    else groups.push({ crops: [u.crops], rate: u.rate || "", phi: u.phi || "" });
  }
  const catalogNos = [catalogNo.get(x.p)!];
  const ai = activeAr(x);
  const pct = x.pct && !/\+/.test(x.active) ? ` ${x.pct}%` : "";
  // المحصول بكلمة العميل نفسها (الطماطم) بدل عنوان المجموعة في الدليل
  const qWords = wordsOf(msg);
  const cropWord = hit.length ? qWords.find((w) => { const k = wKey(w); return k.length >= 3 && !bn.includes(k) && hit.some((u) => norm(u.crops).includes(k)); }) || "" : "";
  if (groups.length === 1) {
    const g = groups[0];
    const where = cropWord ? ` على ${cropWord}` : "";
    return {
      summary: `معدل ${brand} (${ai}${pct})${where}: ${g.rate || "حسب ملصق المنتج"}.`,
      advice: [g.rate ? `المعدل: ${g.rate}` : "", phiLine(g.phi), "الالتزام بملصق المنتج."].filter(Boolean),
      catalogNos,
      askCrop: false,
    };
  }
  const sameRate = groups.every((g) => g.rate === groups[0].rate);
  const lines = groups.slice(0, 5).map((g) => {
    // المحصول محدد ← نفرّق بالآفة؛ غير محدد ← نفرّق بالمحاصيل
    const rowsOf = rows.filter((u) => (u.rate || "") === g.rate && (u.phi || "") === g.phi);
    const dupCrops = !cropWord && groups.filter((o) => o.crops.join("|") === g.crops.join("|")).length > 1;
    const pestsOf = [...new Set(rowsOf.map((u) => u.pests))].join("، ");
    const crops = (cropWord ? pestsOf : dupCrops ? `${g.crops.join("، ").replace(/:.*$/, "")} ← ${pestsOf}` : g.crops.join("، ")).replace(/\s+/g, " ").slice(0, 80);
    const ph = phiLine(g.phi).replace(/^فترة التحريم قبل الحصاد: /, "فترة التحريم ").replace(/\.$/, "");
    return sameRate ? `${crops}: ${ph}` : `${crops}: المعدل ${g.rate}${ph ? `، ${ph}` : ""}`;
  });
  return {
    summary: sameRate
      ? `معدل ${brand} (${ai}${pct}): ${groups[0].rate}، وفترة التحريم تختلف حسب المحصول.`
      : `معدل ${brand} (${ai}${pct})${cropWord ? ` على ${cropWord} يختلف حسب الآفة:` : " يختلف حسب المحصول:"}`,
    advice: [sameRate ? `المعدل: ${groups[0].rate}` : "", ...lines, "الالتزام بملصق المنتج."].filter(Boolean),
    catalogNos,
    askCrop: !cropWord,
  };
}

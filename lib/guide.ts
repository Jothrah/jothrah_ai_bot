import pesticidesData from "@/data/knowledge/guide/pesticides.json";
import listsData from "@/data/knowledge/guide/lists.json";
import fertRegData from "@/data/knowledge/guide/fertilizer-registration.json";

/**
 * معرفة جذرة الموسعة:
 * - دليل المبيدات الزراعية في المملكة العربية السعودية 1446 (المادة الفعالة، النوع، المجموعة، فترة الدخول، المحاصيل والآفات المسجلة)
 * - قائمة المبيدات المقيدة والمحظورة من نفس الدليل
 * - متطلبات تسجيل الأسمدة ومحسنات التربة (وزارة البيئة والمياه والزراعة / الشركة الوطنية للخدمات الزراعية)
 */

type GuideUse = { crops: string; pests: string };
type GuideEntry = {
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

const indexed = guide.map((e) => ({
  e,
  hayUses: norm(e.uses.map((u) => `${u.crops} ${u.pests}`).join(" ")),
  hayName: norm(`${e.ai_en} ${e.ai_ar} ${e.chem_group}`),
  hayType: norm(`${e.type} ${e.props}`),
}));

/** أفضل مواد فعالة من الدليل تطابق كلام العميل (محصول/آفة/اسم مادة). */
const PEST_RE = /حشر|آف|افه|افات|مبيد|مرض|أمراض|فطر|عفن|بياض|تبقع|لفح|صراصير|نمل|بعوض|ذباب|بق|سوس|دود|حشرة المن|تربس|عنكب|اكاروس|أكاروس|فئران|قوارض|حشائش|أعشاب|نيماتود|قواقع|pest|insect|disease|fung|weed/i;

export function searchGuide(text: string, limit = 6) {
  if (FERT_RE.test(text) && !PEST_RE.test(text)) return [];
  const toks = tokens(text);
  if (!toks.length) return [];
  return indexed
    .map((x) => {
      let score = 0;
      for (const t of toks) {
        if (x.hayName.includes(t)) score += 6;
        if (x.hayUses.includes(t)) score += 3;
        if (x.hayType.includes(t)) score += 1;
      }
      return { e: x.e, score };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

export function formatGuideEntries(entries: GuideEntry[]) {
  return entries
    .map((e) => {
      const uses = e.uses
        .slice(0, 4)
        .map((u) => `  - ${u.crops} ← ${u.pests}`)
        .join("\n");
      return [
        `• ${e.ai_ar || e.ai_en} (${e.ai_en}) — ${e.type}`,
        `  المجموعة الكيميائية: ${e.chem_group} | مجموعة المقاومة: ${e.moa || "-"} | الهيئة: ${e.formulation}`,
        `  فترة عودة الدخول: ${e.rei || "-"} | استخدام مقيد: ${e.restricted}`,
        e.props ? `  خواص: ${e.props}` : "",
        uses ? `  الاستخدامات المسجلة (المحصول ← الآفة):\n${uses}` : "",
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
  const hit = (item: ListItem) => {
    const first = norm(item.name).split(/[\s(\[]/)[0];
    return first.length >= 4 && n.includes(first);
  };
  const r = lists.restricted.filter(hit);
  const b = lists.banned.filter(hit);
  const asksLegal = LEGAL_RE.test(text);
  if (!asksLegal && !r.length && !b.length) return "";

  const parts: string[] = [];
  if (r.length || b.length) {
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

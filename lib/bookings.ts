import { z } from "zod";

/** حجوزات خدمة رش المنازل داخل الرياض */

export const BOOKING_STATUSES = ["pending", "contacted", "confirmed", "done", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "جديد — غير مؤكد",
  contacted: "تم التواصل",
  confirmed: "مؤكد",
  done: "تم التنفيذ",
  cancelled: "ملغي",
};

export const PLACE_TYPES = ["شقة", "دور", "فيلا", "استراحة", "مكتب أو محل", "مستودع", "غير ذلك"] as const;
export const PERIODS = ["صباحاً (8 - 12)", "عصراً (12 - 5)", "مساءً (5 - 10)", "أي وقت"] as const;
export const PESTS = [
  "صراصير",
  "بق الفراش",
  "نمل",
  "نمل أبيض (أرضة)",
  "فئران",
  "بعوض وذباب",
  "عقارب وزواحف",
  "براغيث وقراد",
  "غير متأكد",
] as const;

/** حدود تقريبية واسعة لمدينة الرياض (خط عرض/طول) */
export const RIYADH_BOUNDS = { minLat: 24.35, maxLat: 25.2, minLng: 46.3, maxLng: 47.2 };

export function insideRiyadh(lat?: number | null, lng?: number | null) {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  const b = RIYADH_BOUNDS;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

const clean = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max));

/** يحوّل الأرقام العربية والفارسية إلى إنجليزية ويرجع رقم جوال سعودي بصيغة 9665XXXXXXXX */
export function normalizeSaudiPhone(raw: string) {
  const ascii = String(raw || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^\d]/g, "");
  let n = ascii;
  if (n.startsWith("00966")) n = n.slice(5);
  else if (n.startsWith("966")) n = n.slice(3);
  if (n.startsWith("0")) n = n.slice(1);
  return /^5\d{8}$/.test(n) ? `966${n}` : null;
}

export const bookingInputSchema = z.object({
  name: clean(80).pipe(z.string().min(2, "اكتب اسمك")),
  phone: z.string().max(30),
  district: clean(80).pipe(z.string().min(2, "اكتب الحي")),
  addressNote: clean(300).optional().default(""),
  placeType: z.enum(PLACE_TYPES),
  placeSize: clean(60).optional().default(""),
  pests: z.array(z.enum(PESTS)).min(1, "اختر الآفة").max(PESTS.length),
  pestNote: clean(500).optional().default(""),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .default(""),
  preferredPeriod: z.enum(PERIODS),
  lat: z.number().finite().nullable().optional(),
  lng: z.number().finite().nullable().optional(),
  accuracy: z.number().finite().nullable().optional(),
  notes: clean(800).optional().default(""),
  agree: z.literal(true),
  source: clean(200).optional().default(""),
  website: z.string().max(0).optional().default(""), // فخ للبوتات — لازم يكون فاضي
});

export type BookingInput = z.infer<typeof bookingInputSchema>;

export function makeBookingRef() {
  const d = new Date(Date.now() + 3 * 3600 * 1000); // توقيت الرياض
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, "");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `R${ymd}-${rnd}`;
}

/** تاريخ اليوم بتوقيت الرياض بصيغة YYYY-MM-DD */
export function riyadhToday() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export const ADMIN_PATCH_SCHEMA = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  adminNote: clean(2000).optional(),
  confirmedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
  confirmedTime: clean(40).optional(),
  price: z.number().min(0).max(1000000).nullable().optional(),
  paymentStatus: z.enum(["unpaid", "paid"]).optional(),
  paymentMethod: z.enum(["cash", "transfer", "card"]).or(z.literal("")).optional(),
});

import { z } from "zod";

/** الإدارة المالية: دخل حجوزات الرش ومصاريفها */

export const PAYMENT_METHODS = ["cash", "transfer", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "كاش",
  transfer: "تحويل",
  card: "شبكة",
};

export const EXPENSE_CATEGORIES = ["مبيدات ومواد", "بنزين ومواصلات", "عمالة", "معدات وصيانة", "تسويق وإعلانات", "أخرى"] as const;

const clean = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""));

export const EXPENSE_SCHEMA = z.object({
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive().max(10000000),
  note: clean(500).optional().default(""),
  bookingId: z.string().uuid().or(z.literal("")).optional().default(""),
});

export const EXPENSE_PATCH_SCHEMA = EXPENSE_SCHEMA.partial();

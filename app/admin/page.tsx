import { redirect } from "next/navigation";

/** مدخل تطبيق الإدارة: يفتح آخر قسم استخدمته (المحادثات أو الحجوزات) */
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const last = (await cookies()).get("jothrah_admin_last")?.value;
  redirect(last === "bookings" ? "/admin/bookings" : last === "finance" ? "/admin/finance" : "/admin/conversations");
}

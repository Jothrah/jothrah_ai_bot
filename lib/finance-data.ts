import { supabaseAdmin } from "@/lib/supabase-admin";

export const FIN_BOOKING_COLS =
  "id,ref,customer_name,district,place_type,status,confirmed_date,updated_at,price,payment_status,payment_method,paid_at";

export async function loadFinanceData() {
  const [b, e] = await Promise.all([
    supabaseAdmin
      .from("spray_bookings")
      .select(FIN_BOOKING_COLS)
      .in("status", ["confirmed", "done"])
      .order("confirmed_date", { ascending: false, nullsFirst: false })
      .limit(3000),
    supabaseAdmin.from("finance_expenses").select("*").order("spent_on", { ascending: false }).limit(5000),
  ]);
  if (b.error) throw b.error;
  if (e.error) throw e.error;
  return { bookings: b.data || [], expenses: e.data || [] };
}

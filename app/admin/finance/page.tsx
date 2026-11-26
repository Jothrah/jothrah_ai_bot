import type { Metadata } from "next";
import { loadFinanceData } from "@/lib/finance-data";
import FinanceClient from "./FinanceClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الإدارة المالية | جذرة",
};

export default async function FinancePage() {
  let data: Awaited<ReturnType<typeof loadFinanceData>> = { bookings: [], expenses: [] };
  let loadError = "";
  try {
    data = await loadFinanceData();
  } catch {
    loadError = "تعذر تحميل البيانات المالية";
  }
  return <FinanceClient initialBookings={data.bookings} initialExpenses={data.expenses} loadError={loadError} />;
}

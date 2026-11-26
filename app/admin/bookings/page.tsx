import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import BookingsClient from "./BookingsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "حجوزات الرش | جذرة",
};

type PageProps = { searchParams?: Promise<{ id?: string }> };

export default async function BookingsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) || {};
  const { data, error } = await supabaseAdmin
    .from("spray_bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <BookingsClient
      initialBookings={data || []}
      initialSelectedId={String(sp.id || "")}
      loadError={error ? "تعذر تحميل الحجوزات" : ""}
    />
  );
}

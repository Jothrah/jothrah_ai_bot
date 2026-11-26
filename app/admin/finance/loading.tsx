import AdminShellLoading from "../AdminShellLoading";

/** يظهر فوراً أثناء التحميل — نفس الشريط العلوي للأقسام */
export default function Loading() {
  return <AdminShellLoading active="finance" text="جاري تحميل الحسابات…" />;
}

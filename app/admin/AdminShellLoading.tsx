/** هيكل التحميل الموحّد لأقسام الإدارة: نفس الشريط العلوي بالضبط حتى ما يصير وميض عند التنقل */
type Section = "conversations" | "bookings" | "finance";

const TABS: { key: Section; label: string }[] = [
  { key: "conversations", label: "💬 المحادثات" },
  { key: "bookings", label: "📅 الحجوزات" },
  { key: "finance", label: "💰 المالية" },
];

const TITLES: Record<Section, string> = {
  conversations: "محادثات جذرة",
  bookings: "حجوزات رش المنازل",
  finance: "الإدارة المالية",
};

export default function AdminShellLoading({ active, text }: { active: Section; text: string }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8f6", fontFamily: "'IBM Plex Sans Arabic',system-ui,-apple-system,sans-serif", direction: "rtl", color: "#0b2e1f" }}>
      <div style={{ background: "#0b2e1f", color: "#fff", paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 16px 0", display: "flex", gap: 6 }}>
          {TABS.map((t) => (
            <span
              key={t.key}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "10px 4px",
                borderRadius: 12,
                border: "1px solid transparent",
                whiteSpace: "nowrap",
                background: t.key === active ? "#e2b64c" : "#173f2e",
                color: t.key === active ? "#0b2e1f" : "#d5e4dc",
                fontWeight: 700,
                fontSize: 14,
                lineHeight: "normal",
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 16px 16px", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: "#e2b64c", color: "#0b2e1f", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20, flex: "none" }}>ج</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: "block", fontSize: 17 }}>{TITLES[active]}</b>
            <small style={{ color: "#b9cfc3", fontSize: 13 }}>{text}</small>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 72, borderRadius: 16, background: "#fff", border: "1px solid #e3ece6", opacity: 1 - i * 0.2 }} />
        ))}
      </div>
    </div>
  );
}

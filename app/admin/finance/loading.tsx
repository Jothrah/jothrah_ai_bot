/** يظهر فوراً أثناء تحميل الإدارة المالية */
export default function Loading() {
  const tab = (t: string, on = false) => (
    <span style={{ flex: 1, textAlign: "center", padding: "10px 4px", borderRadius: 12, background: on ? "#e2b64c" : "#173f2e", color: on ? "#0b2e1f" : "#d5e4dc", fontWeight: 700, fontSize: 14 }}>{t}</span>
  );
  return (
    <div style={{ minHeight: "100vh", background: "#f5f8f6", fontFamily: "'IBM Plex Sans Arabic',system-ui,sans-serif", direction: "rtl" }}>
      <div style={{ background: "#0b2e1f", color: "#fff", padding: "calc(12px + env(safe-area-inset-top)) 16px 16px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 6 }}>
          {tab("💬 المحادثات")}
          {tab("📅 الحجوزات")}
          {tab("💰 المالية", true)}
        </div>
        <div style={{ maxWidth: 1280, margin: "14px auto 0", fontWeight: 700, fontSize: 17 }}>الإدارة المالية</div>
      </div>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 78, borderRadius: 16, background: i === 3 ? "#0b2e1f" : "#fff", border: "1px solid #e3ece6" }} />
        ))}
      </div>
      <p style={{ color: "#5f7a6c", textAlign: "center" }}>جاري تحميل الحسابات…</p>
    </div>
  );
}

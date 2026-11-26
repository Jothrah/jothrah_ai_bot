/** يظهر فوراً أثناء تحميل الحجوزات */
export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f8f6", fontFamily: "'IBM Plex Sans Arabic',system-ui,sans-serif", direction: "rtl" }}>
      <div style={{ background: "#0b2e1f", color: "#fff", padding: "14px 18px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 6 }}>
          <span style={{ padding: "9px 16px", borderRadius: 12, background: "#173f2e", color: "#d5e4dc", fontWeight: 700, fontSize: 14 }}>💬 المحادثات</span>
          <span style={{ padding: "9px 16px", borderRadius: 12, background: "#e2b64c", color: "#0b2e1f", fontWeight: 700, fontSize: 14 }}>📅 حجوزات الرش</span>
        </div>
        <div style={{ maxWidth: 1280, margin: "12px auto 0", fontWeight: 700, fontSize: 18 }}>حجوزات رش المنازل</div>
      </div>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 82, borderRadius: 16, background: "#fff", border: "1px solid #e3ece6", opacity: 1 - i * 0.2 }} />
        ))}
        <p style={{ color: "#5f7a6c", textAlign: "center", margin: "10px 0 0" }}>جاري تحميل الحجوزات…</p>
      </div>
    </div>
  );
}

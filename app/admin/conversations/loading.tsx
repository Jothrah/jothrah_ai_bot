/** يظهر فوراً أثناء تحميل المحادثات */
export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#e9efec", fontFamily: "'IBM Plex Sans Arabic',system-ui,sans-serif", direction: "rtl" }}>
      <div style={{ maxWidth: 420, background: "#fff", minHeight: "100vh", padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 12, background: "#0b4a42", color: "#fff", fontWeight: 700, fontSize: 14 }}>💬 المحادثات</span>
          <span style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 12, background: "#f6f8f7", border: "1px solid #dbe4e0", fontWeight: 700, fontSize: 14 }}>📅 حجوزات الرش</span>
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 64, borderRadius: 14, background: "#f6f8f7", opacity: 1 - i * 0.15 }} />
          ))}
          <p style={{ color: "#5a6b66", textAlign: "center" }}>جاري تحميل المحادثات…</p>
        </div>
      </div>
    </div>
  );
}

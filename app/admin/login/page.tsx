import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function AdminLoginPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const hasError = searchParams?.error === "1";
  const nextPath = searchParams?.next || "/admin/conversations";

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.badge}>Jothrah AI Support</div>

        <h1 style={styles.title}>تسجيل دخول لوحة جذرة</h1>
        <p style={styles.subtitle}>
          أدخل بيانات الأدمن للوصول إلى محادثات العملاء.
        </p>

        {hasError ? (
          <div style={styles.error}>بيانات الدخول غير صحيحة.</div>
        ) : null}

        <form method="post" action="/admin/login/submit" style={styles.form}>
          <input type="hidden" name="next" value={nextPath} />

          <label style={styles.label}>
            اسم المستخدم
            <input
              name="username"
              type="text"
              required
              autoComplete="username"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            كلمة المرور
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              style={styles.input}
            />
          </label>

          <button type="submit" style={styles.button}>
            دخول
          </button>
        </form>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#071426",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    direction: "rtl",
    color: "#fff",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: 20
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#0c1d33",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 20px 60px rgba(0,0,0,.35)"
  },
  badge: {
    display: "inline-flex",
    background: "#12345a",
    border: "1px solid rgba(255,255,255,.12)",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    marginBottom: 18
  },
  title: {
    margin: 0,
    fontSize: 24
  },
  subtitle: {
    margin: "8px 0 18px",
    color: "#b8c4d6",
    lineHeight: 1.7
  },
  error: {
    background: "rgba(220, 53, 69, .15)",
    border: "1px solid rgba(220, 53, 69, .35)",
    color: "#ffb8c1",
    borderRadius: 12,
    padding: 10,
    marginBottom: 14
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    color: "#dce7f5",
    fontSize: 14
  },
  input: {
    border: "1px solid rgba(255,255,255,.14)",
    background: "#071426",
    color: "#fff",
    borderRadius: 12,
    padding: "12px 14px",
    outline: "none",
    fontSize: 15
  },
  button: {
    border: 0,
    borderRadius: 12,
    background: "#2f8b5a",
    color: "#fff",
    padding: "13px 16px",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 15
  }
};
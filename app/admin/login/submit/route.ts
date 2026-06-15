import { NextRequest, NextResponse } from "next/server";

async function createSessionValue(username: string, password: string) {
  const raw = `${username}:${password}`;
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const nextPath = String(formData.get("next") || "/admin/conversations");

  const adminUsername = process.env.ADMIN_USERNAME || "";
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (
    !adminUsername ||
    !adminPassword ||
    username !== adminUsername ||
    password !== adminPassword
  ) {
    return NextResponse.redirect(
      new URL("/admin/login?error=1", req.url),
      303
    );
  }

  const sessionValue = await createSessionValue(adminUsername, adminPassword);

  const safeNextPath = nextPath.startsWith("/admin")
    ? nextPath
    : "/admin/conversations";

  const response = NextResponse.redirect(new URL(safeNextPath, req.url), 303);

  response.cookies.set("jothrah_admin_session", sessionValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}
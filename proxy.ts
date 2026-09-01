import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken, COOKIE_NAME } from "@/lib/auth-cookie";

const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/settings/public",
  "/api/settings/logo",
  "/api/cron",
  "/shared",
  // Client portal — its own public auth + a dedicated session cookie. Portal
  // routes authenticate the portal client themselves, separate from internal
  // admin/staff sessions, so the internal guard must not block them.
  "/portal",
  "/api/portal",
  "/_next",
  "/favicon",
];

const ADMIN_ONLY_PREFIXES = ["/settings", "/users"];

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)).*)"],
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const secret = process.env.APP_PASSWORD ?? "";
  if (!secret) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await parseSessionToken(token);

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const redirected = req.nextUrl.clone();
  if (ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) && user.role !== "admin") {
    redirected.pathname = "/";
    redirected.search = "";
    return NextResponse.redirect(redirected);
  }

  // Carry the user's identity to downstream server code via a header.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-auth-user", JSON.stringify(user));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

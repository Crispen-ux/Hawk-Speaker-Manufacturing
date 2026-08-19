import { NextRequest, NextResponse } from "next/server";
import { hmacSign } from "@/lib/crypto-edge";

const COOKIE_NAME = "ledger_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/settings/public") ||
    pathname.startsWith("/api/settings/logo") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const secret = process.env.APP_PASSWORD ?? "";
  if (!secret) return NextResponse.next(); // no password configured

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const [value, sig] = token?.split(".") ?? [];
  const valid = value && sig && (await hmacSign(value, secret)) === sig;

  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

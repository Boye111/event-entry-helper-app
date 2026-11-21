import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/session";

/**
 * First line of defence: right kind of cookie for each area (signature only).
 * Route handlers and pages re-check against the DB, and check event ownership (lib/auth.ts).
 *   /admin, /api/admin           super admin (ADMIN_PASSWORD)
 *   /dashboard, /api/org         organiser / helper accounts (super admin may open event pages to help)
 *   /scan, scanner APIs          ushers, accounts, super admin
 */
const PUBLIC = ["/admin/login", "/scan/login"];

function allowedRoles(pathname: string): Role[] {
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) return ["super"];
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/org")) return ["organiser", "super"];
  return ["usher", "organiser", "super"];
}

function loginFor(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/admin/login";
  if (pathname.startsWith("/scan")) return "/scan/login";
  return "/login";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname) || pathname.startsWith("/scan/join/")) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session && allowedRoles(pathname).includes(session.role)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: session ? "You don't have access to this." : "Please log in." },
      { status: session ? 403 : 401 },
    );
  }
  const login = new URL(loginFor(pathname), req.url);
  if (login.pathname === "/login") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/scan/:path*",
    "/api/admin/:path*",
    "/api/org/:path*",
    "/api/checkin",
    "/api/guests/:path*",
    "/api/stats",
  ],
};

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Guards admin + scanner pages and their APIs. Route handlers re-check the role too (defence in depth).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login" || pathname === "/scan/login" || pathname.startsWith("/scan/join/")) {
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const needsAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const allowed = session && (!needsAdmin || session.role === "admin");
  if (allowed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: session ? "Admins only." : "Please log in." }, { status: session ? 403 : 401 });
  }
  const login = new URL(pathname.startsWith("/admin") ? "/admin/login" : "/scan/login", req.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/scan/:path*",
    "/api/admin/:path*",
    "/api/checkin",
    "/api/guests/:path*",
    "/api/stats",
  ],
};

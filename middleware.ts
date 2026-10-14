import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // 1. Allow public access to the admin login page and login API route
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  // 2. Protect all other /admin routes (like /admin/dashboard)
  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get("trustship_admin_session");

    if (!session || session.value !== "authenticated") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // 3. Protect protected API routes under /api/admin
  if (pathname.startsWith("/api/admin") && pathname !== "/api/admin/login") {
    const session = request.cookies.get("trustship_admin_session");
    if (!session || session.value !== "authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
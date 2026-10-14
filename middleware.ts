import { NextResponse } from "next/server";

export function middleware(request: any) {
  const { pathname } = new URL(request.url);

  // Protect all /admin/... and /api/admin/... routes
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminRoute) {
    // Check for ADMIN_SECRET via header formats or cookie
    let adminSecret = "";

    // Format 1: x-admin-secret header
    adminSecret = request.headers.get("x-admin-secret");

    // Format 2: Authorization: Bearer <secret>
    if (!adminSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        adminSecret = authHeader.substring(7);
      }
    }

    // Format 3: admin_secret cookie (HTTP-only, secure)
    if (!adminSecret) {
      adminSecret = request.cookies.get("admin_secret")?.value;
    }

    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      // Block with 401 Unauthorized - immediately redirect/block unauthorized access
      return new NextResponse(null, { status: 401 });
    }
  }

  // Continue to the route handler
  return null;
}
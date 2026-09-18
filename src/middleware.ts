/**
 * Next.js Middleware
 *
 * Responsibilities:
 * 1. Protect authenticated routes — redirect unauthenticated users to /login
 * 2. Redirect authenticated users away from auth pages
 * 3. Refresh Supabase session tokens on every request
 *
 * SECURITY NOTE: This is a first-line defence only.
 * Every API route and Server Component must also verify auth independently
 * using requireAuth() from @/lib/auth/session.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes accessible without authentication
const PUBLIC_ROUTES = ["/login", "/signup", "/auth/callback"];

// Routes that require authentication
const PROTECTED_PREFIXES = ["/dashboard", "/content", "/review", "/publishing", "/audit", "/settings"];

// API routes that handle their own auth
const API_PREFIX = "/api";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Pass through API routes — they handle auth internally
  if (pathname.startsWith(API_PREFIX)) {
    return NextResponse.next();
  }

  // Create a response to allow cookie mutation
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create Supabase client that can refresh the session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
          });
        },
      },
    }
  );

  // Refresh session — important for rotating JWTs
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "?"));
  const isProtectedRoute = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // Redirect unauthenticated users away from protected routes
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect root → dashboard
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

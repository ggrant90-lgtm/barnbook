import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function isProtectedPath(pathname: string): boolean {
  // /care/* is the public care card — always allow unauthenticated access
  if (pathname === "/care" || pathname.startsWith("/care/")) return false;

  // /offline is the PWA offline fallback — always allow
  if (pathname === "/offline") return false;

  // Legal pages are public
  if (pathname === "/terms" || pathname === "/privacy") return false;

  // /barn/{id} is the public barn profile — allow unauthenticated access
  // But /barn/new and /barn/{id}/edit are protected
  if (pathname.startsWith("/barn/") && pathname !== "/barn/new" && !pathname.endsWith("/edit")) return false;

  const prefixes = [
    "/admin",
    "/dashboard",
    "/barn",
    "/horses",
    "/keys",
    "/profile",
    "/calendar",
    "/identify",
    "/settings",
    "/requests",
    "/breeders-pro",
    "/business-pro",
    "/embryo-bank",
  ];
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value, c);
  });
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
              response.headers.set(key, value);
            });
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (user && pathname === "/") {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
    copyCookies(response, redirect);
    return redirect;
  }

  if (user && (pathname.startsWith("/auth/signin") || pathname.startsWith("/auth/signup"))) {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
    copyCookies(response, redirect);
    return redirect;
  }

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    url.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );
    const redirect = NextResponse.redirect(url);
    copyCookies(response, redirect);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

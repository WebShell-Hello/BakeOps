import { type NextRequest, NextResponse } from "next/server";

const publicRoutes = new Set(["/login", "/register"]);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.next();
  if (publicRoutes.has(pathname)) return NextResponse.next();
  if (request.cookies.has("sessionid")) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  const destination = `${pathname}${search}`;
  if (destination !== "/") loginUrl.searchParams.set("next", destination);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};

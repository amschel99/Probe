import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Better Auth session cookie names
  const candidates = [
    "probe.session_token",
    "__Secure-probe.session_token",
    "better-auth.session_token",
  ];
  const hasSession = candidates.some((name) => !!req.cookies.get(name)?.value);
  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

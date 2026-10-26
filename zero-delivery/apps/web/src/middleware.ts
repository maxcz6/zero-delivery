import { NextResponse, type NextRequest } from "next/server";

const API_INTERNAL =
  process.env["API_INTERNAL_URL"] ?? "http://localhost:4000/api/v1";

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin",
  COORDINATOR: "/coordinator",
  BRANCH_MANAGER: "/kitchen",
  SUPPORT_AGENT: "/orders",
  RIDER: "/rider",
};

const ROUTE_ROLES: Record<string, string[]> = {
  "/admin": ["ADMIN"],
  "/coordinator": ["ADMIN", "COORDINATOR"],
  "/kitchen": ["ADMIN", "COORDINATOR", "BRANCH_MANAGER"],
  "/orders": ["ADMIN", "COORDINATOR", "SUPPORT_AGENT"],
  "/rider": ["RIDER"],
};

function loginRedirect(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  const { pathname, search } = url;
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/" && pathname !== "/login") {
    url.searchParams.set("next", `${pathname}${search}`);
  }
  const res = NextResponse.redirect(url);
  res.cookies.delete("zd_session");
  return res;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Las rutas /api/* son el proxy hacia NestJS: nunca deben pasar por el control de sesión.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has("zd_session");

  if (!hasSession) {
    if (pathname === "/login") return NextResponse.next();
    return loginRedirect(req);
  }

  let role: string;
  try {
    const res = await fetch(`${API_INTERNAL}/auth/me`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return loginRedirect(req);
    const body = (await res.json()) as { actor?: { role?: string } };
    role = body.actor?.role ?? "";
  } catch {
    // API caída: dejar pasar para que la UI muestre el error de red.
    return NextResponse.next();
  }

  const home = ROLE_HOME[role];
  if (!home) return loginRedirect(req);

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL(home, req.url));
  }

  const protectedPrefix = Object.keys(ROUTE_ROLES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (protectedPrefix) {
    const allowed = ROUTE_ROLES[protectedPrefix];
    if (allowed && !allowed.includes(role)) {
      return NextResponse.redirect(new URL(home, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.png|.*\\.svg).*)",
  ],
};

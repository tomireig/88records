import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authDisabled, verifyToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  if (authDisabled()) return NextResponse.next();

  if (!process.env.APP_PASSWORD || !process.env.AUTH_SECRET) {
    return new NextResponse("Falta configurar APP_PASSWORD y AUTH_SECRET.", { status: 503 });
  }

  if (await verifyToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = req.nextUrl.pathname === "/" ? "" : `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Todo menos el login, los archivos estáticos y el ícono.
  matcher: ["/((?!login|_next/static|_next/image|icon.svg|favicon.ico).*)"],
};

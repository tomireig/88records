import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authDisabled, verifyToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  // Sin base o sin contraseña no hay app: se muestra qué falta configurar.
  if (!process.env.DATABASE_URL || (!process.env.APP_PASSWORD && !authDisabled())) {
    return NextResponse.rewrite(new URL("/setup", req.url));
  }

  if (authDisabled() || req.nextUrl.pathname === "/login") return NextResponse.next();

  if (await verifyToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = req.nextUrl.pathname === "/" ? "" : `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Todo menos los archivos estáticos y el ícono.
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};

// Sesión mínima: una cookie firmada con HMAC. Usa Web Crypto, así anda igual en el
// middleware (edge) y en las server actions (node).
// shortcut: una sola contraseña de equipo (APP_PASSWORD); pasar a usuarios con Auth.js cuando haya roles.

export const SESSION_COOKIE = "88os_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta AUTH_SECRET");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara en tiempo constante (sobre los hashes, así el largo no filtra nada). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  const x = new Uint8Array(ha!);
  const y = new Uint8Array(hb!);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

export async function createToken(): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  return `${exp}.${await hmac(String(exp))}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp));
}

/** Sin APP_PASSWORD en desarrollo, la app queda abierta (uso local). En producción, nunca. */
export function authDisabled(): boolean {
  return !process.env.APP_PASSWORD && process.env.NODE_ENV !== "production";
}

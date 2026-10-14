// Sesión de equipo con contraseña (APP_PASSWORD) mientras no haya Supabase Auth.
// Cookie firmada con HMAC por Web Crypto: funciona igual en el middleware (edge) y en el servidor.

export const TEAM_COOKIE = "88_team";
export const TEAM_DAYS = 30;

const enc = new TextEncoder();

function secret(): string {
  // Sin AUTH_SECRET firma con la contraseña: cambiarla cierra todas las sesiones.
  const s = process.env.AUTH_SECRET || process.env.APP_PASSWORD;
  if (!s) throw new Error("Falta APP_PASSWORD");
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara en tiempo constante sobre los hashes, así el largo no filtra nada. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  const x = new Uint8Array(ha!);
  const y = new Uint8Array(hb!);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

export async function createTeamToken(): Promise<string> {
  const exp = Date.now() + TEAM_DAYS * 86_400_000;
  return `${exp}.${await hmac(String(exp))}`;
}

export async function verifyTeamToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp));
}

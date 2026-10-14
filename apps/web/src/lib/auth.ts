import "server-only";
import { db, type Organization, type Role, type User } from "@88/db";
import { redirect } from "next/navigation";
import { cache } from "react";
import { cookies } from "next/headers";
import { authMode, supabaseServer, teamEmail } from "./supabase";
import { TEAM_COOKIE, verifyTeamToken } from "./team-session";

export interface Session {
  user: User;
  org: Organization;
  role: Role;
}

const DEFAULT_ORG = { slug: "88records", name: "88RECORDS®" };

async function ensureMembership(email: string, authId: string | null, asOwner: boolean): Promise<Session | null> {
  let user = await db.user.findFirst({
    where: authId ? { OR: [{ authId }, { email }] } : { email },
    include: { memberships: { include: { organization: true }, orderBy: { createdAt: "asc" } } },
  });

  if (!user && asOwner) {
    const org = await db.organization.upsert({ where: { slug: DEFAULT_ORG.slug }, update: {}, create: DEFAULT_ORG });
    await db.user.create({
      data: { email, authId, memberships: { create: { organizationId: org.id, role: "owner" } } },
    });
    return ensureMembership(email, authId, false);
  }
  if (!user) return null;
  if (authId && user.authId !== authId) user = { ...user, ...(await db.user.update({ where: { id: user.id }, data: { authId } })) };

  const m = user.memberships[0];
  if (!m) {
    if (!asOwner) return null;
    const org = await db.organization.upsert({ where: { slug: DEFAULT_ORG.slug }, update: {}, create: DEFAULT_ORG });
    await db.membership.create({ data: { userId: user.id, organizationId: org.id, role: "owner" } });
    return ensureMembership(email, authId, false);
  }
  return { user, org: m.organization, role: m.role };
}

/** Sesión actual o null. Cacheada por request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const mode = authMode();
  if (mode === "local") {
    const email = (process.env.LOCAL_USER_EMAIL || "local@88records.dev").toLowerCase();
    return ensureMembership(email, null, true);
  }
  if (mode === "password") {
    const token = (await cookies()).get(TEAM_COOKIE)?.value;
    return (await verifyTeamToken(token)) ? ensureMembership(teamEmail(), null, true) : null;
  }
  if (mode === "none") return null;

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!data.user || !email) return null;
  const owners = (process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return ensureMembership(email, data.user.id, owners.includes(email));
});

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Para server actions: tira error en vez de redirigir. */
export async function sessionOrThrow(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("La sesión venció. Volvé a entrar.");
  return s;
}

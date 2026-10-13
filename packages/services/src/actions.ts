// Bandeja de aprobación: operaciones comunes a todos los tipos de acción.
import { db } from "@88/db";

export async function discardActions(organizationId: string, userId: string, actionIds: string[]): Promise<number> {
  const res = await db.action.updateMany({
    where: { id: { in: actionIds }, organizationId, status: "proposed" },
    data: { status: "discarded", decidedById: userId, decidedAt: new Date() },
  });
  return res.count;
}

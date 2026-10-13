import type { CreatorInfo } from "@88/connectors/tiktok";
import { db } from "@88/db";
import { tiktok, withAccessToken } from "./accounts";
import { TIKTOK_PUBLISH, type TikTokPublishPayload } from "./autofill";
import { schedulePost, ValidationError, type PublishChoices } from "./posts";

export interface ApprovalResult {
  approved: number;
  errors: { actionId: string; message: string }[];
}

/**
 * Aprueba propuestas de publicación. Las elecciones de privacidad y permisos las hizo el
 * usuario en la pantalla de publicación (una vez para el lote); el caption de cada propuesta
 * se respeta salvo que venga uno editado.
 */
export async function approveTikTokActions(params: {
  organizationId: string;
  userId: string;
  actionIds: string[];
  choices: Omit<PublishChoices, "caption"> & { caption?: string };
}): Promise<ApprovalResult> {
  const actions = await db.action.findMany({
    where: { id: { in: params.actionIds }, organizationId: params.organizationId, type: TIKTOK_PUBLISH, status: "proposed" },
  });
  const infoByAccount = new Map<string, CreatorInfo>();
  const result: ApprovalResult = { approved: 0, errors: [] };

  for (const action of actions) {
    const payload = action.payload as unknown as TikTokPublishPayload;
    try {
      let info = infoByAccount.get(payload.accountId);
      if (!info) {
        info = await withAccessToken(payload.accountId, (t) => tiktok().creatorInfo(t));
        infoByAccount.set(payload.accountId, info);
      }
      const post = await schedulePost({
        organizationId: params.organizationId,
        userId: params.userId,
        accountId: payload.accountId,
        videoId: payload.videoId,
        at: new Date(payload.scheduledFor),
        choices: { ...params.choices, caption: params.choices.caption ?? payload.caption },
        info,
        actionId: action.id,
      });
      await db.action.update({
        where: { id: action.id },
        data: { status: "approved", decidedById: params.userId, decidedAt: new Date(), result: { postId: post.id } },
      });
      result.approved++;
    } catch (err) {
      const message = err instanceof ValidationError || err instanceof Error ? err.message : "No se pudo aprobar";
      result.errors.push({ actionId: action.id, message });
    }
  }
  return result;
}

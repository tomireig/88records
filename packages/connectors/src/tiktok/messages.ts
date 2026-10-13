// Mensajes en castellano para los errores que devuelve TikTok. Lo que no está acá se muestra con su código.

const ERRORS: Record<string, string> = {
  access_token_invalid: "La sesión de TikTok de esta cuenta venció. Reconectala.",
  invalid_grant: "TikTok rechazó la autorización. Reconectá la cuenta.",
  scope_not_authorized: "La cuenta no dio permiso para publicar. Reconectala y aceptá todos los permisos.",
  rate_limit_exceeded: "TikTok frenó por exceso de pedidos. Se reintenta solo en unos minutos.",
  spam_risk_too_many_posts: "La cuenta llegó al tope diario de publicaciones de TikTok.",
  spam_risk_user_banned_from_posting: "TikTok tiene bloqueada la publicación en esta cuenta.",
  reached_active_user_cap: "La app llegó al tope diario de cuentas que pueden publicar (5 mientras no esté auditada).",
  unaudited_client_can_only_post_to_private_accounts:
    "Mientras la app no esté auditada, la cuenta tiene que estar en privado para publicar. Pasala a privada en TikTok y reintentá.",
  privacy_level_option_mismatch: "La privacidad elegida ya no está disponible para esta cuenta. Volvé a elegirla.",
  url_ownership_unverified: "El dominio del video no está verificado en TikTok.",
  invalid_publish_id: "TikTok no reconoce esta publicación.",
  token_not_authorized_for_specified_publish_id: "Esta publicación pertenece a otra conexión de la cuenta.",
  internal_error: "TikTok tuvo un error interno. Se reintenta solo.",
  invalid_param: "TikTok rechazó un dato de la publicación.",
};

const FAIL_REASONS: Record<string, string> = {
  file_format_check_failed: "El formato del archivo no es compatible con TikTok.",
  duration_check_failed: "El video supera la duración máxima de la cuenta.",
  frame_rate_check_failed: "El frame rate del video no es compatible.",
  picture_size_check_failed: "La resolución del video no es compatible.",
  internal: "TikTok tuvo un error interno procesando el video.",
  video_pull_failed: "TikTok no pudo bajar el video.",
  publish_cancelled: "La publicación se canceló.",
  auth_removed: "La cuenta le quitó el permiso a la app.",
  spam_risk_too_many_posts: "La cuenta llegó al tope diario de publicaciones.",
  spam_risk_user_banned_from_posting: "TikTok tiene bloqueada la publicación en esta cuenta.",
  spam_risk_text: "TikTok marcó el texto del caption como riesgoso.",
  spam_risk: "TikTok frenó la publicación por riesgo de spam.",
};

export function describeTikTokError(code: string, detail = ""): string {
  const known = ERRORS[code];
  if (known) return code === "invalid_param" && detail ? `${known} (${detail})` : known;
  return detail ? `TikTok devolvió ${code}: ${detail}` : `TikTok devolvió ${code}.`;
}

export function describeFailReason(reason: string): string {
  return FAIL_REASONS[reason] ?? `TikTok no pudo publicar (${reason}).`;
}

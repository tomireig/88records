export type ErrorKind =
  /** El token venció o lo revocaron: hay que refrescar o reconectar. */
  | "auth"
  /** Límite de la API: reintentar más tarde. */
  | "rate_limit"
  /** Falla temporal del lado de la plataforma. */
  | "transient"
  /** No va a funcionar reintentando igual (parámetros, permisos, cuenta). */
  | "permanent";

export class PlatformError extends Error {
  constructor(
    message: string,
    readonly kind: ErrorKind,
    readonly code: string,
    readonly logId?: string,
  ) {
    super(message);
    this.name = "PlatformError";
  }

  get retriable(): boolean {
    return this.kind === "rate_limit" || this.kind === "transient";
  }
}

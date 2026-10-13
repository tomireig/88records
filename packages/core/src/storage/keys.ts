/** Las keys se arman en el servidor; esto evita rutas raras si alguna vez llega una de afuera. */
export function assertSafeKey(key: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error("Key de storage inválida");
  }
}

export function videoKey(orgId: string, videoId: string, ext: string): string {
  return `org/${orgId}/videos/${videoId}.${ext}`;
}

export function thumbnailKey(orgId: string, videoId: string): string {
  return `org/${orgId}/thumbs/${videoId}.jpg`;
}

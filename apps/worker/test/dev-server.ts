// API de TikTok simulada para probar el panel en local sin la app real de TikTok.
// Uso: pnpm --filter @88/worker fake-tiktok y en el .env:
//   TIKTOK_API_BASE=http://127.0.0.1:4555  TIKTOK_AUTH_BASE=http://127.0.0.1:4555
//   TIKTOK_CLIENT_KEY=dev  TIKTOK_CLIENT_SECRET=dev
// Nunca apuntar producción acá.
import { startFakeTikTok } from "./fake-tiktok";

const fake = await startFakeTikTok(Number(process.env.FAKE_TIKTOK_PORT || 4555));
console.log(`API de TikTok simulada en ${fake.url}. Ctrl+C para cortar.`);

# 88RECORDS® · Plataforma

Panel de marketing del sello. Hoy funciona el **Panel TikTok™**: conectar varias cuentas, subir videos, armar la semana en un calendario, aprobar y publicar, con el estado real de cada publicación. El motor de contenido (análisis de audio, transcripción, textos y render de videos) está listo como paquetes y se está conectando al panel.

El contexto completo, las reglas de producto y el plan por etapas están en [CLAUDE.md](CLAUDE.md).

## Cómo está armado

| Parte | Qué hace | Dónde corre |
| --- | --- | --- |
| `apps/web` | Panel (Next.js 15). Las server actions y route handlers son el backend | Vercel |
| `apps/worker` | Procesa videos, publica en TikTok, sigue estados, refresca tokens, renderiza | La PC de Tomi |
| `packages/db` | Prisma + Postgres, multi-tenant (Organización → Artista → Lanzamiento) | |
| `packages/core` | Cifrado de tokens, storage (disco o S3/R2), colas pg-boss, fechas | |
| `packages/connectors` | Cliente de TikTok (OAuth, `creator_info`, subida por chunks, estado) | |
| `packages/services` | Lógica del panel: cuentas, publicaciones, autollenado, bandeja | |
| `packages/audio` | BPM, beats, tonalidad (con Camelot), energía, drops, estribillo, fragmentos | Worker |
| `packages/ai` | Textos con Ollama o plantillas; Whisper local para la letra | Worker |
| `packages/video` | FFmpeg: miniaturas y render de hook, visualizer, lyric y BTS | Worker |

Las colas usan **pg-boss** sobre el mismo Postgres: no hace falta Redis.

## Correr en la compu

Requisitos: Node 22.12 o más nuevo y pnpm 10 (`npm i -g pnpm@10`).

```bash
pnpm install
cp .env.example .env        # en Windows: copy .env.example .env
pnpm keygen                 # pegá el resultado en TOKEN_ENCRYPTION_KEY del .env
```

Terminal 1, la base local (queda abierta):

```bash
pnpm db:local
```

Terminal 2:

```bash
pnpm db:deploy
pnpm db:seed
pnpm dev                    # panel en http://localhost:3000, sin login en local
```

Terminal 3, el worker (sin él no se publica nada; el panel avisa si está apagado):

```bash
pnpm worker
```

### Probar sin la app real de TikTok

Hay una API de TikTok simulada para desarrollo. Con ella se puede conectar cuentas, publicar y ver todos los estados:

```bash
pnpm --filter @88/worker fake-tiktok
```

y en el `.env`:

```
TIKTOK_API_BASE=http://127.0.0.1:4555
TIKTOK_AUTH_BASE=http://127.0.0.1:4555
TIKTOK_CLIENT_KEY=dev
TIKTOK_CLIENT_SECRET=dev
TIKTOK_DIRECT_POST_ENABLED=true
```

Nunca uses esos valores en producción.

## Tests

```bash
pnpm test
```

- `packages/core`, `connectors`, `audio`, `ai` y `video`: unitarios, incluyen renders y análisis reales con FFmpeg.
- `apps/worker`: el circuito completo contra la base local y la API simulada (necesita `pnpm db:local`).
- Whisper real: `RUN_WHISPER=1 WHISPER_SAMPLE=ruta/a/voz.wav pnpm --filter @88/ai test` (baja el modelo la primera vez).

## Producción (Vercel)

El proyecto `88records` de Vercel apunta a `apps/web`: cada push a `main` se despliega solo. Las migraciones corren en el build.

Variables en Vercel → Settings → Environment Variables:

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Las carga sola la integración de Neon (Storage → Neon). También sirven las `POSTGRES_*` de otras integraciones |
| `APP_PASSWORD` | Contraseña de equipo para entrar mientras no haya Supabase Auth |
| `OWNER_EMAILS` | Mail del dueño (con la contraseña de equipo se entra como esa persona) |
| `TOKEN_ENCRYPTION_KEY` | La misma que en el `.env` de la PC (el worker tiene que poder leer los tokens) |
| `APP_URL` | `https://88records-tomireig.vercel.app` (o el dominio propio) |
| `STORAGE_DRIVER=s3` y `S3_*` | Cloudflare R2 o Supabase Storage. Sin esto no se pueden subir videos en Vercel |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | La app de TikTok for Developers. Redirect URI: `{APP_URL}/api/tiktok/callback` |
| `TIKTOK_DIRECT_POST_ENABLED`, `TIKTOK_APP_AUDITED` | Modo de publicación (ver CLAUDE.md) |

El worker en la PC tiene que apuntar a la **misma base y el mismo storage** que Vercel: copiá esas variables en el `.env` de la PC.

Para la auditoría de TikTok, la app ya tiene la pantalla de publicación con las reglas, la [política de privacidad](apps/web/src/app/(legal)/privacidad/page.tsx) en `/privacidad` y los [términos](apps/web/src/app/(legal)/terminos/page.tsx) en `/terminos` (revisalos antes de mandarla y cargá `LEGAL_CONTACT_EMAIL`).

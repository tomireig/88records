# CLAUDE.md · 88RECORDS® Platform

Este archivo le da contexto a Claude Code sobre el proyecto. Leelo entero antes de tocar código.

## Quién y qué

Tomi Reig (Tomas), productor, DJ e ingeniero de audio en Buenos Aires. Fundador de **88RECORDS®**, sello independiente con artistas en Argentina, Chile y Puerto Rico, más de 20M de streams en el catálogo. Co-creador del **techengue** (tech house + cumbia argentina).

El objetivo de este repo es una plataforma única de marketing musical para el sello: planificar lanzamientos, producir contenido en volumen, generar clips de video automáticamente y publicarlos en redes, todo desde un mismo panel.

Idioma de trabajo: español rioplatense (voseo). La UI, los textos generados y los comentarios de producto van en español. Nombres de variables y código en inglés.

## Identidad visual (obligatoria en toda UI)

- Naranja saturado `#FF4D00`
- Azul ultramarino eléctrico `#1E1EE6`
- Blanco
- Tipografía Helvetica (fallback: `"Helvetica Neue", Arial, sans-serif`)
- Estética editorial Off-White / Virgil Abloh: comillas como etiquetas ("CAMPAÑA"), mayúsculas, grilla industrial, mucho contraste
- El nombre siempre va como **88RECORDS®** y los productos internos con ™ (ej. Marketing OS™)

## Las dos piezas que existen hoy

### 1. 88RECORDS® Marketing OS™ (prototipo)

App HTML de un solo archivo con persistencia local. Funciona, pero es un prototipo: la idea es migrarla como app dentro del monorepo. Módulos:

1. **Panel**: tracks, campañas, views, adds, mails, superfans, vencimientos de la semana
2. **Campañas**: por release genera 15 tareas con fechas reales de D−28 a D+30 (D−28 subir a la distribuidora, D−21 pitch editorial y arranque del batch de contenido, D0 release, D+14 doblar en el formato que mejor rindió, D+30 retro). Alertas de tareas vencidas
3. **Contenido**: kanban de piezas (idea → guion → grabado → editado → publicado) por plataforma y formato. Botón "Generar batch 20 piezas" que arma 4 semanas con mix de formatos (hook/reveal, storytelling, BTS, lyric, challenge, dueto, visualizer)
4. **IA Studio**: llamadas a la API de Claude para hooks de 3 segundos, guiones, captions con hashtags, conceptos visuales con la paleta de marca, prompts de imagen/video, calendarios de 2 semanas y bios. Con fallback local
5. **Catálogo**: tracks con metadata de audio
6. **Pitching**: CRM de curadores con matching por género, pipeline kanban con follow-ups, generador de pitch editorial (500 caracteres) y DM a curadores en ES/EN
7. **Fan Funnel**: snapshots mensuales y calculadora de superfans (~USD 52/año por superfan, conversión 1–3% de oyentes)
8. **Análisis**: qué formato y plataforma rinde más, conversión de pitches, costo por add
9. **Playbook**: casos reales (Lil Nas X, Rosalía, Lola Índigo, Benson Boone, Blessd) convertidos en lecciones accionables

Complemento: script Node con la Spotify Web API oficial (Client Credentials, solo lectura) que busca playlists por género y exporta candidatos a CSV.

### 2. Plataforma de automatización de video (en desarrollo)

Toma material del sello (sets, videos de artistas), detecta los mejores momentos, genera clips verticales con subtítulos y los programa en TikTok (después Instagram y YouTube).

**Stack**

- Monorepo con pnpm workspaces + Turborepo
- `apps/web`: Next.js 15, TypeScript, Tailwind, shadcn/ui, Auth.js v5. Los route handlers son el backend, no hay Express aparte
- `apps/worker`: Node + BullMQ, corre FFmpeg
- `apps/transcriber`: sidecar Python con faster-whisper (timestamps por palabra)
- `packages/db`: Prisma + PostgreSQL
- `packages/video`: wrappers de FFmpeg reproducibles; cada render guarda sus `RenderParams` en JSON
- `packages/social`: interfaz `SocialProvider` → `TikTokProvider` primero, Instagram y YouTube después sin tocar el core
- `packages/ai`: `AIProvider` (Anthropic, OpenAI, Ollama) y `TranscriptionProvider`
- Storage S3 (MinIO en docker-compose), signed URLs con expiración
- Tokens OAuth cifrados con AES-256-GCM (`TOKEN_ENCRYPTION_KEY`), nunca en claro
- Redis para BullMQ

**Pipeline**

1. Ingesta: upload de archivo propio (flujo principal) o `yt-dlp` solo para contenido con permiso
2. Transcripción word-level → el LLM devuelve JSON con segmentos, score y motivo
3. Cada corte se ajusta al silencio más cercano (`silencedetect`) para no cortar a mitad de frase
4. Contenido sin voz (sets): fallback a energía RMS y detección de drops con librosa
5. Reencuadre 9:16 dinámico con tracking (MediaPipe/OpenCV), no crop centrado fijo
6. Subtítulos ASS karaoke quemados con FFmpeg
7. Publicación programada con delayed jobs de BullMQ (`PUBLISH_VIDEO`), porque TikTok no tiene scheduling nativo

**Realidades de las APIs que condicionan el diseño**

- TikTok Content Posting API v2: sin auditoría aprobada todo cae como borrador en el inbox de la cuenta. Flag `TIKTOK_DIRECT_POST_ENABLED` alterna entre "Enviado a borradores" y "Publicado"
- Cada cuenta necesita su propio OAuth. Solo cuentas propias del sello o de sus artistas
- Analytics de TikTok: views, likes, comments, shares. Watch time y completion rate no están en la API pública, se muestran como `unavailable`
- Contenido duplicado entre cuentas se detecta por hash: la variación tiene que ser real (hook, primer frame, crop, ±3% velocidad, orden de clips), no solo el caption
- Instagram exige cuenta Business y app de Meta aprobada. YouTube limita por cuota diaria (~6 uploads por día por proyecto)
- No crear cuentas en masa ni automatizar registros: viola los términos de las plataformas y termina en baneos

**Plan por etapas** (cada una compila y se verifica antes de pasar a la siguiente)

1. Monorepo, schema Prisma + migraciones, docker-compose (Postgres, Redis, MinIO), auth, infra de jobs, shell del dashboard
2. Import (upload + yt-dlp), storage, thumbnails, Content Library
3. Transcripción, highlights, generación de clips, subtítulos karaoke, render, editor
4. OAuth TikTok, cuentas, publicaciones, scheduler, calendario
5. Analytics, templates, hooks con IA, seed, README, producción

**Estado actual:** el pipeline de publicación multi-cuenta está en curso, pero su código todavía no está en este repo. Antes de seguir, revisá el repo y confirmá qué etapas están terminadas y cuáles no.

**Marketing OS™ (13/10/2026):** ya migrado al monorepo. Los nueve módulos corren en `apps/web` con datos en Postgres (`packages/db`), e IA Studio usa `packages/ai`. Sin auth todavía y sin Redis ni MinIO en el compose: se suman con el pipeline de video. Para correr Postgres sin Docker: `pnpm db:local`.

Antecedente: una versión local en Node que replicaba content.ready (videos cortos sincronizados al beat, Whisper, dirección con Ollama, stock de Pexels). Hay ideas para reutilizar ahí.

## Hacia dónde va (propuesta, a confirmar con Tomi)

Unir las dos piezas en este monorepo:

- Migrar el Marketing OS a `apps/web` como secciones del mismo dashboard, con datos en Postgres en vez de storage local
- Conectar **Contenido** del Marketing OS con el pipeline de video: una pieza del kanban puede disparar la generación de clips y su publicación
- **IA Studio** pasa a usar `packages/ai`
- **Análisis** se alimenta de las métricas reales de las publicaciones

## Cómo trabajar en este repo

- Verificar que compile (`tsc`, build) y que corra con `docker compose up` antes de dar algo por terminado
- Cambios chicos y por etapa. Si algo de la arquitectura no cierra, preguntar antes de rehacerlo
- Nada de secretos en el código. Todo por variables de entorno, con `.env.example` actualizado
- Textos de UI naturales, en rioplatense, que no suenen a IA

## Skills y agentes del proyecto

Instalados como markdown en `.claude/skills` y `.claude/agents` (sin hooks ni scripts). Fuentes y licencias en `.claude/licenses/`.

**Contexto de marca:** `.agents/product-marketing.md`. Todas las skills de marketing lo leen primero. Si tiene huecos marcados "A COMPLETAR", no inventar: preguntarle a Tomi.

**Cuándo usar cada cosa:**
- Textos que lee alguien de afuera (UI, captions, mails, pitches, bios, landing): `ai-copywriter`, después adaptado a rioplatense con voseo. Sus reglas anti-IA aplican también a los prompts de `packages/ai`.
- Lanzamientos y campañas: `launch`, `content-strategy`, `social`, `video`.
- Pitching a curadores y prensa: `public-relations`, `cold-email`, `influencer-marketing`.
- Fans, mails y superfans: `emails`, `community-marketing`, `referrals`, `lead-magnets`.
- Métricas y experimentos: `analytics`, `ab-testing`, `attribution`.
- Web y SEO del sello: `seo-audit`, `ai-seo`, `schema`, `site-architecture`, `cro`.
- Ads pagos: `ads`, `ad-creative`.
- Código: `ponytail` (la solución más chica que funcione). Para revisar: `ponytail-review`.
- Tareas largas y separables: subagentes `content-creator`, `growth-hacker`, `seo-specialist`, `proposal-strategist` (propuestas a marcas y sponsors), `carousel-growth-engine`.

**Reglas:**
- Las skills están en inglés y pensadas para SaaS. Adaptar al contexto de un sello de música, y todo lo que se entrega va en rioplatense.
- `carousel-growth-engine` puede publicar en TikTok e Instagram con APIs externas. Nunca publicar ni gastar sin que Tomi lo confirme.
- Las skills que nombran herramientas pagas o "partners" son sugerencias, no requisitos.

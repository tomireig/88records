# CLAUDE.md · 88RECORDS® Platform

Leelo entero antes de tocar código. Este archivo reemplaza cualquier plan anterior: el "Marketing OS" de checklists y consejos quedó descartado.

## Qué es

El panel de marketing para artistas independientes que **hace el trabajo**, no que lo explica. El artista conecta sus cuentas, sube el tema y pone la fecha. La plataforma analiza el audio, arma la campaña, genera los videos, escribe los textos, encuentra a quién pitchear, propone anuncios y publica. El artista solo aprueba.

Regla de producto: **si una función consiste en que el usuario cargue datos a mano o tilde un checklist, está mal diseñada.** Todo dato se obtiene por conexión, por análisis o por importación automática. Toda recomendación se convierte en una acción ejecutable.

- Dueño: Tomi Reig (Tomas), fundador de 88RECORDS®, sello independiente con artistas en Argentina, Chile y Puerto Rico
- Fase 1: uso interno de 88RECORDS (varios artistas del sello)
- Fase 2: SaaS con suscripción mensual para artistas independientes
- Mercado: LatAm, en español. Cualquier género. Inglés y otros mercados más adelante
- Sale bajo la marca 88RECORDS®
- Presupuesto actual: USD 0. Todo el stack tiene que entrar en planes gratuitos hasta que haya ingresos
- Equipo: Tomi solo, construyendo con Claude Code

## Principio central: bandeja de aprobación

Nada se ejecuta sin que el usuario lo apruebe. Todos los motores generan **acciones propuestas** que caen en una bandeja única:

- Cada acción muestra qué va a pasar, una vista previa (el video, el mail, el anuncio), y por qué se propone
- Botones: Aprobar, Editar, Descartar. Aprobación en lote para acciones del mismo tipo
- Al aprobar, un job la ejecuta y registra el resultado
- Las acciones con plata (anuncios) muestran el gasto máximo y siempre requieren aprobación individual

Modelo: `Action { id, artistId, releaseId?, type, payload, preview, reason, status: proposed|approved|executing|done|failed|discarded, scheduledFor?, result? }`

## El flujo del artista

1. **Conecta** sus cuentas (Instagram/Facebook, TikTok, YouTube, Gmail, Meta Ads)
2. **Sube el release**: WAV/MP3, portada, fecha, y opcionalmente videos crudos (estudio, show, videoclip) y letra
3. **El sistema analiza** el audio y arma la campaña completa de D−28 a D+30 como acciones propuestas
4. **El artista aprueba** desde la bandeja (web y celular)
5. **Se ejecuta**: publicaciones programadas, mails, pitches, anuncios
6. **Se mide** solo, todos los días
7. **El manager IA** lee los números y propone las siguientes acciones: doblar el formato que funciona, pautar el post que despegó, pitchear a más curadores, mandar mail a los fans

## Motores (módulos)

### 1. Conexiones
OAuth por artista contra cada plataforma. Tokens cifrados AES-256-GCM (`TOKEN_ENCRYPTION_KEY`), refresh automático, aviso cuando una conexión se cae. Interfaz común `PlatformConnector`.

### 2. Análisis de audio
Al subir el tema, worker Python con librosa:
- BPM, tonalidad, duración, curva de energía, detección de drops y estribillos
- Los mejores fragmentos de 7, 15 y 30 segundos para video corto (picos de energía, entrada del hook)
- Transcripción con timestamps por palabra (faster-whisper) si tiene voz, para subtítulos y para identificar el hook letrístico
- Perfil del tema (mood, género estimado) para captions, pitch y segmentación de anuncios

### 3. Motor de contenido (genera los videos, no ideas de videos)
- Toma los fragmentos del análisis + material del artista (videos, fotos, portada) + visuales de stock (Pexels API, gratis) o generados
- Renderiza con FFmpeg en 9:16 y 1:1: cortes al beat, reencuadre dinámico, subtítulos karaoke ASS, portada animada, visualizer
- Formatos: hook/reveal, lyric video, visualizer, BTS con texto, antes/después, trend con el sonido
- Variantes reales por pieza (hook, primer frame, crop, orden) para testear y para no repetir contenido entre plataformas
- Genera caption, hashtags y hora sugerida con IA
- Propone un batch de 20 a 30 piezas por release, distribuidas en el calendario, cada una como acción en la bandeja
- Cada render guarda sus `RenderParams` en JSON para poder rehacerlo o variarlo

### 4. Publicador
Publicación programada con jobs diferidos de BullMQ. Interfaz `SocialProvider`:
- **Instagram/Facebook** (Graph API, cuenta Business o Creator): Reels, posts, stories
- **TikTok** (Content Posting API): sin auditoría, los videos llegan como borrador al inbox de la cuenta; con auditoría, publica directo. Flag `TIKTOK_DIRECT_POST_ENABLED`
- **YouTube** (Data API): Shorts y videos. Proyectos sin auditoría suben como privados; pedir la auditoría temprano
- Las auditorías y revisiones de app son gratis pero tardan semanas: iniciarlas en paralelo al desarrollo

### 5. Smart links y captura de fans
- Página por release (`88records.../artista/tema`) con links a todas las plataformas, con el branding del artista
- Antes del release: "avisame cuando salga" que captura mail (y WhatsApp más adelante) y dispara el aviso el día D
- Tracking de clics por plataforma, por fuente (UTM) y por país
- **Pre-save de Spotify no está disponible** (ver restricciones). No prometerlo en la UI

### 6. Fans y mails
- CRM de fans alimentado solo por las capturas de los smart links
- Automatizaciones: aviso de lanzamiento, agradecimiento, adelantos, invitación a shows
- Envío con Resend (plan gratuito: ~3.000 mails/mes, 100/día). Dominio propio verificado

### 7. Pitching
- Base de curadores (playlists independientes, blogs, radios, canales de YouTube) con género, contacto, idioma, historial de respuestas
- Matching automático entre el perfil del tema y los curadores
- Mails personalizados por IA para cada curador, enviados desde el Gmail del artista (Gmail API) tras aprobación, con follow-up programado
- Lectura de respuestas para marcar estado (respondió, aceptó, rechazó) sin carga manual
- Pitch editorial de Spotify for Artists: se genera el texto (500 caracteres) listo para pegar; no hay API para enviarlo

### 8. Anuncios
- Meta Marketing API (Instagram/Facebook): el sistema elige el post orgánico con mejor rendimiento, propone campaña con objetivo, audiencia (países, intereses por género y artistas similares), presupuesto diario y tope total
- Al aprobar, crea la campaña en la cuenta publicitaria del artista. La plata la pone el artista en su propia cuenta
- Monitoreo diario: propone pausar, escalar o cambiar creativo según costo por resultado
- TikTok Ads después

### 9. Analítica automática
- YouTube Analytics API, Instagram Insights, TikTok (métricas por video), clics de smart links, aperturas de mails, resultados de anuncios: todo se trae solo con jobs diarios
- Spotify: importación del CSV de Spotify for Artists (el usuario arrastra el archivo, se parsea y se integra solo) hasta poder pagar un proveedor de datos (Songstats o Chartmetric)
- Vista por artista, por release y por pieza de contenido: qué formato, plataforma y hora rinde más

### 10. Manager IA
- Corre a diario: lee la analítica y el estado de la campaña, detecta qué funciona y qué no
- Genera acciones concretas en la bandeja, cada una con su motivo ("este hook tuvo 3x el promedio de retención: 5 variantes nuevas listas")
- Reporte semanal automático por artista (y consolidado para el sello)
- Chat para preguntarle sobre el rendimiento de cualquier artista o release

## Restricciones reales (condicionan el diseño)

- **Spotify Web API:** desde mayo de 2025 el acceso extendido es solo para organizaciones con 250.000 usuarios activos mensuales, y desde febrero de 2026 el modo desarrollo exige Premium y limita a 5 usuarios. Conclusión: **no construir nada que dependa de la API de Spotify para usuarios del SaaS** (ni pre-saves, ni login con Spotify, ni stats). Uso interno puntual con la cuenta de Tomi está bien
- **Spotify for Artists** no tiene API: stats por CSV o proveedor pago
- **Meta, TikTok y YouTube** piden revisión de la app para operar cuentas de terceros a escala. Gratis, pero lleva tiempo. Durante la fase interna alcanza con los modos de desarrollo y las cuentas del sello agregadas como testers
- **Solo cuentas reales del artista** conectadas por OAuth. Nunca crear cuentas en masa, automatizar registros ni simular actividad: viola los términos y hace caer el producto entero
- **Nada de streams o seguidores artificiales.** 88RECORDS ya sufrió la detección de streams artificiales con "Carmesí"; la plataforma tiene que ser defendible ante las distribuidoras

## Stack (todo en planes gratuitos)

- Monorepo: pnpm workspaces + Turborepo
- `apps/web`: Next.js 15, TypeScript, Tailwind, shadcn/ui. Route handlers como backend
- `apps/worker`: Node + BullMQ, orquesta jobs (render, publicación, ingesta de métricas, mails, manager IA)
- `apps/audio`: servicio Python (librosa, faster-whisper, FFmpeg) para análisis y transcripción
- `packages/db`: Prisma sobre Postgres de Supabase (plan gratis). Auth con Supabase Auth
- `packages/connectors`: `PlatformConnector` y `SocialProvider` por plataforma
- `packages/video`: wrappers de FFmpeg y plantillas de formatos
- `packages/ai`: `AIProvider` con Gemini y Groq (tiers gratuitos) y Ollama local como respaldo. Anthropic y OpenAI enchufables cuando haya presupuesto
- Storage: Cloudflare R2 (10 GB gratis, sin costo de descarga) vía SDK de S3, URLs firmadas
- Colas: Redis (Upstash gratis, o Redis local en desarrollo)
- Mails: Resend
- Hosting: Vercel Hobby para la web durante la fase interna. **El worker y el servicio de audio corren en la PC de Tomi** (render y transcripción son pesados y no entran en ningún plan gratis). Al pasar a SaaS: VPS y Vercel Pro, pagados con las primeras suscripciones
- Cobros (fase SaaS): Mercado Pago suscripciones para LatAm, Stripe después
- Multi-tenant desde el día uno: todo cuelga de `Organization → Artist → Release`, aunque al principio la única organización sea 88RECORDS

## Panel multicuenta de TikTok (prioridad)

Módulo propio dentro de la app, usable desde el primer día aunque el resto de los motores no exista todavía. Sirve para manejar todas las cuentas de TikTok del sello y de sus artistas desde un solo lugar y automatizar la subida con un calendario.

**Cuentas**
- Botón "Conectar cuenta" → abre el login oficial de TikTok (Login Kit, OAuth 2.0 con PKCE). El usuario inicia sesión en TikTok y autoriza; la app recibe tokens, nunca la contraseña
- Se conectan tantas cuentas como haga falta, cada una con su propio token cifrado (AES-256-GCM) y refresh automático antes de que venza
- Tarjeta por cuenta: avatar, nombre, artista al que pertenece, estado de la conexión (activa, por vencer, caída → botón reconectar), publicaciones de hoy contra el límite diario, próxima publicación
- Scopes: `user.info.basic`, `video.upload` (modo borrador) y `video.publish` (publicación directa)
- **Prohibido**: guardar contraseñas, automatizar el login con navegador headless, crear cuentas o usar proxies para disfrazar dispositivos. Eso viola los términos de TikTok y hace caer todas las cuentas

**Biblioteca**
- Subida de videos por drag & drop (y después, los que genere el motor de contenido), con preview, duración y hash
- Aviso si el mismo archivo (mismo hash) se programa en más de una cuenta: TikTok penaliza contenido duplicado entre cuentas

**Calendario**
- Vista semana y mes, una fila o color por cuenta
- Arrastrar un video de la biblioteca a un horario de una cuenta = programarlo. Arrastrar dentro del calendario = reprogramar
- Reglas por cuenta: franjas horarias preferidas, máximo de posts por día (el tope real de TikTok ronda los 15 por cuenta, compartido entre apps), plantilla de caption y hashtags
- "Autollenar semana": reparte los videos pendientes en los huecos libres respetando las reglas. Queda todo como propuesta en la bandeja de aprobación hasta que el usuario confirma
- Cada publicación es un job diferido de BullMQ (`tiktok.publish`) con reintentos y backoff

**Pantalla de publicación (obligatoria por las reglas de TikTok, si no la app no pasa la auditoría)**
- Al abrirla, consultar `creator_info` de la cuenta: mostrar el nickname, bloquear si la cuenta no puede publicar ahora, respetar la duración máxima
- Selector de privacidad solo con las opciones que devuelve `creator_info`, sin valor por defecto
- Toggles de Comentarios, Dúo y Stitch, todos apagados por defecto, deshabilitados si la cuenta los tiene apagados
- Divulgación de contenido comercial ("Tu marca" / "Contenido de marca"), apagada por defecto
- Texto de consentimiento con link a la Music Usage Confirmation de TikTok (y Branded Content Policy si aplica)
- Preview del video, sin marcas de agua agregadas
- Estas elecciones se guardan con cada publicación programada; el job publica exactamente lo que el usuario aprobó

**Estado**
- Después de subir, consultar el endpoint de estado hasta que termine: "Procesando", "En borradores", "Publicado", "Error" (con el motivo y botón reintentar)
- Historial por cuenta

**Realidad de la API (mostrarla en la UI, no esconderla)**
- Mientras la app no esté auditada: máximo 5 cuentas pueden publicar por día y todo sale como privado (`SELF_ONLY`); las cuentas tienen que estar en privado al publicar. El panel muestra un banner "Modo sin auditar" con esto
- Modo borrador (`video.upload`): el video llega a la bandeja de la app de TikTok y la persona termina de publicarlo ahí. Útil durante la fase interna
- Pedir la auditoría de la app en cuanto el panel esté funcionando; requiere política de privacidad, términos y un video demo del flujo
- Flag `TIKTOK_DIRECT_POST_ENABLED` para alternar entre modo borrador y publicación directa

## Dirección visual: futurista y limpia

Reemplaza la estética editorial anterior. La app tiene que sentirse viva, como un instrumento de alta gama, sin caer en lo recargado.

- **Base oscura** casi negra con profundidad (no negro plano), superficies en capas con bordes de 1px y vidrio sutil solo donde aporta jerarquía. Modo claro opcional después
- **Color**: el naranja `#FF4D00` y el ultramarino `#1E1EE6` de 88RECORDS se usan como luz, no como relleno: acentos, estados, brillos detrás de elementos activos, gradientes muy controlados. Blanco y grises fríos para el texto
- **Tipografía**: sans geométrica o grotesca moderna para la interfaz y una monoespaciada para números, horas y métricas. La definición final la toma `/impeccable init` y queda en `DESIGN.md`
- **Movimiento con sentido**: transiciones de layout con springs, entradas escalonadas de listas, números que cuentan al actualizarse, hover con respuesta física, drag & drop del calendario fluido, skeletons animados en vez de spinners, estados que laten suave cuando algo está corriendo (un job de render, una publicación en curso)
- **Fondo vivo** solo en login, onboarding y landing (shader o efecto liviano tipo Vanta/WebGL). Dentro del dashboard nada que distraiga ni que baje los FPS
- Todo a 60 fps, respetar `prefers-reduced-motion`, nada de animación que bloquee una acción
- Prohibido el look genérico de plantilla SaaS: gradientes violeta-azul, tarjetas dentro de tarjetas, íconos en cuadradito redondeado arriba de cada título, Inter para todo
- Siempre **88RECORDS®**

## Skills de diseño instaladas (en `.claude/skills/`)

Usarlas siempre que se toque UI:

- **impeccable** (pbakaus/impeccable): dirección de diseño y control de calidad. Al empezar el frontend correr `/impeccable init` para generar `PRODUCT.md` y después `DESIGN.md`. Comandos útiles: `/impeccable shape`, `/impeccable animate`, `/impeccable polish`, `/impeccable audit`, `/impeccable critique`. Trae hooks en `.claude/settings.json` que revisan cada cambio de UI
- **motion-framer**: Motion (ex Framer Motion) para toda la animación de la app: layout, springs, gestos, `AnimatePresence`, drag
- **animated-component-libraries**: Magic UI y React Bits como base de componentes animados sobre shadcn/ui. Adaptarlos a la dirección visual, nunca dejarlos con su estilo por defecto
- **modern-web-design**: patrones actuales, accesibilidad y rendimiento
- **gsap-scrolltrigger**: solo para la landing y el onboarding (timelines y scroll)
- **lightweight-3d-effects**: Vanta, Zdog y tilt para el fondo vivo del login y la landing

Origen: copiadas de github.com/pbakaus/impeccable y github.com/freshtechbro/claudedesignskills (licencias incluidas en cada carpeta). Para actualizar impeccable: `npx impeccable install` desde la raíz.

## Plan de construcción

Cada etapa termina funcionando de punta a punta, compilando y probada con material real del sello antes de pasar a la siguiente.

1. **Base**: monorepo, Supabase (schema, auth, organizaciones, artistas), R2, Redis, colas, `/impeccable init`, sistema de diseño (tokens, tipografía, componentes animados) y shell del dashboard con la dirección visual nueva
2. **Panel multicuenta de TikTok**: conexión OAuth de varias cuentas, biblioteca, calendario con drag & drop, pantalla de publicación según las reglas de TikTok, jobs de publicación y seguimiento de estado. Pedir la auditoría de TikTok al terminar
3. **Del audio al video**: subida del release, análisis de audio, motor de contenido renderizando videos reales que caen en la biblioteca y en la bandeja de aprobación
4. **Más plataformas**: Instagram y YouTube en el mismo publicador y calendario. Iniciar sus revisiones de app
5. **Medición e IA**: ingesta diaria de métricas, importación CSV de Spotify, analítica por pieza, manager IA proponiendo acciones, reporte semanal
6. **Fans**: smart links, captura de mails, CRM, automatizaciones con Resend
7. **Pitching**: base de curadores, matching, mails por Gmail, seguimiento de respuestas
8. **Anuncios**: Meta Marketing API con aprobación y tope de gasto
9. **SaaS**: onboarding de artistas externos, planes y cobro con Mercado Pago, landing, límites por plan

## Cómo trabajar en este repo

- Antes de arrancar una etapa, revisar el estado del repo y proponer el plan de esa etapa
- Verificar que compile, que los tests pasen y que el flujo corra de verdad antes de dar algo por terminado
- Nada de pantallas de mentira: si un módulo no está conectado a datos reales, no se muestra como si funcionara
- Nada de secretos en el código; todo por variables de entorno y `.env.example` actualizado
- Textos de la UI en español rioplatense, naturales, que no suenen a IA. Código y nombres en inglés
- Si algo de este plan choca con la realidad técnica, avisar antes de improvisar

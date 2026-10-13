# 88RECORDS® Marketing OS™ · Cómo seguir en otra compu

Guardado el 13/10/2026. El proyecto está completo en dos lugares:

- **GitHub:** https://github.com/tomireig/88records (rama `main`). Es la copia principal.
- **Este zip:** `88records.zip`, la misma versión, por si no tenés internet o GitHub a mano.

## 1. Instalar lo necesario (una sola vez por compu)

En Windows:

1. **Git for Windows:** https://git-scm.com/download/win (todo por defecto).
2. **Node.js LTS:** https://nodejs.org (el instalador de Windows, todo por defecto).
3. Abrí PowerShell y corré:

```powershell
npm i -g pnpm@10
```

En la Mac es igual: Node desde nodejs.org y después el mismo comando de pnpm en la Terminal.

## 2. Traer el proyecto

**Opción A, desde GitHub (recomendada):**

```powershell
cd $HOME\Documents
git clone https://github.com/tomireig/88records
cd 88records
```

**Opción B, desde el zip:** descomprimí `88records.zip` en Documentos y entrá a la carpeta `88records`.
Ojo: el zip no trae el historial de git. Para subir cambios después, usá la opción A.

## 3. Primera vez en la compu nueva

```powershell
pnpm install
copy .env.example .env
```

En la Mac, en vez de `copy` es `cp .env.example .env`.

**Terminal 1**, la base de datos local (dejala abierta):

```powershell
pnpm db:local
```

**Terminal 2:**

```powershell
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Abrí http://localhost:3000. En local no pide contraseña.

La base local arranca vacía: los datos que cargues en una compu no viajan a la otra. Para tener los mismos datos en todos lados, usá la versión online (punto 5).

## 4. Seguir con Claude Code

Abrí la carpeta `88records` en VS Code y usá Claude Code ahí adentro. Así carga solo:

- El `CLAUDE.md` del repo, con todo el contexto y el estado.
- Las 57 skills de marketing y los 5 agentes (en `.claude/`).
- El contexto de marca en `.agents/product-marketing.md` (tiene huecos "A COMPLETAR").

Para retomar, decile: "leé el CLAUDE.md y el CONTINUAR.md y seguimos con el deploy".

## 5. Lo que falta para tenerla online

El proyecto `88records` ya está creado en Vercel y conectado a GitHub. Cada vez que se sube algo a `main`, se despliega solo. El primer deploy va a fallar hasta que hagas estos dos pasos, porque todavía no tiene base de datos:

1. **Base de datos:** en vercel.com, entrá al proyecto `88records` → pestaña **Storage** → **Create Database** → **Neon** → creala y conectala al proyecto. Carga sola las variables `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.
2. **Contraseña del equipo:** Settings → **Environment Variables** → agregá `APP_PASSWORD` con la contraseña que quieras, para Production y Preview.
3. Pestaña **Deployments** → en el último, los tres puntitos → **Redeploy**.

Opcional: `ANTHROPIC_API_KEY` en las mismas variables, para que IA Studio use Claude en vez de plantillas.

## Estado del proyecto

- **Hecho:** los 9 módulos del Marketing OS™ (Panel, Campañas, Contenido, IA Studio, Catálogo, Pitching, Fan Funnel, Análisis, Playbook), login con contraseña de equipo, probado de punta a punta en navegador.
- **Pendiente:** conectar Neon y la contraseña en Vercel (punto 5), completar el contexto de marca, el pipeline de video del CLAUDE.md.

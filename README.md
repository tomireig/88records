# 88RECORDS® Platform

Monorepo del sello. Hoy tiene el **Marketing OS™** andando: campañas, contenido, IA Studio, catálogo, pitching, fan funnel, análisis y playbook, con los datos en Postgres.

```
apps/web        Next.js 15 (panel)
packages/db     Prisma + Postgres
packages/ai     Proveedor de IA (Claude) con plantillas locales de respaldo
scripts/        Postgres local sin Docker
```

## Arrancar en Windows (primera vez)

Necesitás Node (ya instalado) y pnpm:

```powershell
npm i -g pnpm@10
```

En la carpeta del repo:

```powershell
pnpm install
copy .env.example .env
```

Abrí `.env` y, si querés que IA Studio use Claude, pegá tu key en `ANTHROPIC_API_KEY`. Sin key funciona igual, con plantillas.

**Terminal 1**, la base de datos (dejala abierta):

```powershell
pnpm db:local
```

**Terminal 2**, la primera vez creá las tablas y los artistas:

```powershell
pnpm db:deploy
pnpm db:seed
```

Después, la app:

```powershell
pnpm dev
```

Abrí http://localhost:3000.

## El día a día

Dos terminales: `pnpm db:local` en una y `pnpm dev` en la otra.

Si tenés Docker, podés reemplazar `pnpm db:local` por `docker compose up -d`.

## Online (Vercel)

La app vive en el proyecto `88records` de Vercel, que despliega solo cada vez que se sube algo a `main`.

- **Login:** una contraseña de equipo, en la variable `APP_PASSWORD` del proyecto en Vercel. Para cambiarla, editala ahí y volvé a desplegar.
- **Base de datos:** Neon, conectada desde la pestaña Storage del proyecto. Carga sola `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.
- **Migraciones:** corren solas en cada deploy, antes del build.
- **IA:** para que IA Studio use Claude, agregá `ANTHROPIC_API_KEY` en las variables del proyecto.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Levanta la app en modo desarrollo |
| `pnpm build` | Compila todo (para verificar antes de subir) |
| `pnpm typecheck` | Revisa tipos en todo el monorepo |
| `pnpm db:local` | Postgres local sin Docker, datos en `.local-db/` |
| `pnpm db:migrate` | Crea una migración nueva después de tocar el schema |
| `pnpm db:deploy` | Aplica las migraciones existentes |
| `pnpm db:seed` | Carga los artistas del sello |
| `pnpm db:studio` | Abre Prisma Studio para ver la base |

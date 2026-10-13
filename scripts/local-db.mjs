// Postgres local sin Docker. Guarda los datos en .local-db/ y queda corriendo
// hasta que cortes con Ctrl+C. Si tenés Docker, podés usar `docker compose up -d` en su lugar.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import net from "node:net";

const PORT = 5432;
const dir = "./.local-db";

const portBusy = await new Promise((resolve) => {
  const s = net.connect(PORT, "127.0.0.1");
  s.once("connect", () => (s.destroy(), resolve(true)));
  s.once("error", () => resolve(false));
});
if (portBusy) {
  console.error(
    `El puerto ${PORT} ya está en uso. Puede que la base ya esté corriendo en otra terminal, ` +
      `o que haya otro Postgres instalado. Cerralo y volvé a probar.`,
  );
  process.exit(1);
}

const firstRun = !existsSync(dir);
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "records",
  password: "records",
  port: PORT,
  persistent: true,
  // UTF-8 siempre: en Windows initdb toma la codificación del sistema (WIN1252) y rompe emojis y acentos.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

if (firstRun) {
  console.log("Primera vez: creando la base en .local-db/ …");
  await pg.initialise();
}
await pg.start();
if (firstRun) await pg.createDatabase("records");

console.log(`Postgres corriendo en localhost:${PORT}. Dejá esta terminal abierta (Ctrl+C para cortar).`);

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

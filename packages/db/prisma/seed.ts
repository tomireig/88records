// Seed mínimo: solo artistas del sello. Nada de métricas inventadas.
import { db } from "../src/index";

async function main() {
  for (const a of [
    { name: "Ninestroy", country: "AR", genre: "reggaetón" },
    { name: "Lesta", country: "AR" },
  ]) {
    await db.artist.upsert({ where: { name: a.name }, update: {}, create: a });
  }
  console.log("Seed listo.");
}

main().finally(() => db.$disconnect());

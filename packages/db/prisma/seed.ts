// Crea la organización 88RECORDS y su dueño. No inventa artistas ni cuentas:
// eso se carga desde el panel con datos reales.
import { db } from "../src/index";

const ownerEmail = (process.env.SEED_OWNER_EMAIL || process.env.LOCAL_USER_EMAIL || "local@88records.dev").toLowerCase();

async function main() {
  const org = await db.organization.upsert({
    where: { slug: "88records" },
    update: {},
    create: { name: "88RECORDS®", slug: "88records" },
  });

  const user = await db.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: { email: ownerEmail, name: "Tomi Reig" },
  });

  await db.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: { role: "owner" },
    create: { userId: user.id, organizationId: org.id, role: "owner" },
  });

  console.log(`Listo: ${org.name} con ${user.email} como dueño.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

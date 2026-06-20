// Seed de la base de datos: crea el usuario de prueba documentado en el README.
//
// Es un script independiente que se ejecuta con `tsx`, por lo que no usa el alias `@/`
// (tsx no resuelve los paths de tsconfig). Importamos el cliente generado por ruta
// relativa y reutilizamos `hashPassword` (que solo depende de bcryptjs, sin alias).
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const DEMO_USER = {
  email: "demo@postia.app",
  name: "Usuario Demo",
  // Contraseña en claro solo aquí, para crear el hash. Documentada en el README (req. f).
  password: "Demo1234!",
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Falta DATABASE_URL. Copia .env.example a .env antes de hacer el seed.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });

  try {
    const passwordHash = await hashPassword(DEMO_USER.password);

    // `upsert` hace el seed idempotente: se puede ejecutar varias veces sin duplicar ni
    // fallar, y reestablece la contraseña conocida del usuario demo.
    const user = await prisma.user.upsert({
      where: { email: DEMO_USER.email },
      update: { passwordHash, name: DEMO_USER.name },
      create: { email: DEMO_USER.email, name: DEMO_USER.name, passwordHash },
    });

    console.log(`✓ Usuario demo listo: ${user.email} (contraseña: ${DEMO_USER.password})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error en el seed:", error);
  process.exit(1);
});

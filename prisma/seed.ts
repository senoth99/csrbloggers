import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { hashPassword } from "../src/lib/auth-password";
import { SUPERADMIN_LOGIN } from "../src/lib/panel-auth-utils";

/** Только локальная разработка; на production — SEED_ADMIN_PASSWORD или случайный пароль. */
const DEV_SUPERADMIN_PASSWORD = "admin";

const prisma = new PrismaClient();

function resolvePassword(): string {
  if (process.env.NODE_ENV === "production") {
    const envPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
    if (envPassword) return envPassword;
    const generated = randomBytes(12).toString("hex");
    console.log(
      `\n  Superadmin password: ${generated}\n  Set SEED_ADMIN_PASSWORD in .env on the server.\n`,
    );
    return generated;
  }
  return DEV_SUPERADMIN_PASSWORD;
}

async function main() {
  const password = resolvePassword();
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { login: SUPERADMIN_LOGIN },
    create: {
      login: SUPERADMIN_LOGIN,
      passwordHash,
      role: "superadmin",
      displayName: "Суперадмин",
    },
    update: { passwordHash },
  });

  await prisma.panelSnapshot.upsert({
    where: { id: 1 },
    create: { id: 1, data: {}, revision: 0 },
    update: {},
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

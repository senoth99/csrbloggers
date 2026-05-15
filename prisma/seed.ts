import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { hashPassword } from "../src/lib/auth-password";
import { SUPERADMIN_LOGIN } from "../src/lib/panel-auth-utils";

const prisma = new PrismaClient();

async function main() {
  const envPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const password = envPassword || randomBytes(12).toString("hex");
  if (!envPassword) {
    console.log(`\n  Superadmin password: ${password}\n  Set SEED_ADMIN_PASSWORD in .env to override.\n`);
  }

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

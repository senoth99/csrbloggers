import { PrismaClient } from "@prisma/client";
import { hashLoginPassword } from "../src/lib/auth-password";
import { SUPERADMIN_LOGIN } from "../src/lib/panel-auth-utils";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashLoginPassword(SUPERADMIN_LOGIN, "admin");
  await prisma.user.upsert({
    where: { login: SUPERADMIN_LOGIN },
    create: {
      login: SUPERADMIN_LOGIN,
      passwordHash,
      role: "superadmin",
      displayName: "Суперадмин",
    },
    update: {},
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

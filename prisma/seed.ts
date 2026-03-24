import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (!existing) {
    const hashed = await bcrypt.hash(password, 10);
    await prisma.admin.create({ data: { email, password: hashed } });
    console.log(`Admin created: ${email}`);
  } else {
    console.log(`Admin already exists: ${email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

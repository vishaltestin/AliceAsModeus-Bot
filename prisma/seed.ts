import "dotenv/config"
import { randomUUID } from "crypto"
import bcrypt from "bcryptjs"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { PrismaClient } from "@/generated/prisma/client"

// dotenv/config above loads .env so DATABASE_URL and the PLATFORM_ADMIN_*
// variables are available when this script runs standalone (e.g. via
// `npx tsx prisma/seed.ts` outside the Next.js runtime).

const adapter = new PrismaMariaDb(
  process.env.DATABASE_URL || "mysql://user:pass@localhost:3306/wacrm"
)
const prisma = new PrismaClient({ adapter })

/**
 * Seeds a Platform Admin (role SUPER_ADMIN) and its dedicated platform account.
 *
 * Configure via env:
 *   PLATFORM_ADMIN_EMAIL      (required)
 *   PLATFORM_ADMIN_PASSWORD   (required, min 8 chars)
 *   PLATFORM_ADMIN_NAME       (optional, defaults to "Platform Admin")
 *
 * Run: npx prisma db seed
 */
async function main() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase()
  const password = process.env.PLATFORM_ADMIN_PASSWORD || ""
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Admin"

  if (!email || password.length < 8) {
    console.error(
      "Platform admin seed requires PLATFORM_ADMIN_EMAIL and a PLATFORM_ADMIN_PASSWORD of at least 8 characters."
    )
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Platform admin already exists (${email})`)
    return
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const userId = randomUUID()

  // A platform admin still belongs to an account row to satisfy the FK, but all
  // platform actions bypass account scoping. We give it its own isolated
  // "Platform Admin" account with a very large quota so it never blocks itself.
  const account = await prisma.account.create({
    data: {
      name: "Platform Admin",
      ownerUserId: userId,
      planType: "CUSTOM",
      messageQuota: 1_000_000_000,
    },
  })
  await prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      password: hashedPassword,
      accountId: account.id,
      accountRole: "SUPER_ADMIN",
    },
  })

  console.log(`Platform admin created: ${email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

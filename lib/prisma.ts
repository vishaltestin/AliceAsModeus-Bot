import "dotenv/config"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { PrismaClient } from "@/generated/prisma/client"
import { requireEnv } from "@/lib/env"

type PrismaGlobals = {
  client?: PrismaClient
  proxy?: PrismaClient
}

const globalForPrisma = globalThis as unknown as PrismaGlobals

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.client) {
    const adapter = new PrismaMariaDb(requireEnv("DATABASE_URL"))
    globalForPrisma.client = new PrismaClient({ adapter })
  }

  return globalForPrisma.client
}

// Do not construct the MariaDB adapter while the module is being imported.
// This keeps public/auth pages and production builds usable without database
// credentials while still failing with a clear configuration error when a
// database-backed operation is actually requested.
const lazyPrisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient()
    const value = Reflect.get(client, property, client)
    return typeof value === "function" ? value.bind(client) : value
  },
})

export const prisma = globalForPrisma.proxy ?? lazyPrisma

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.proxy = prisma
}

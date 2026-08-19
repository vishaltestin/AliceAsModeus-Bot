import "next-auth"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    accountId: string
    accountRole: string
  }

  interface Session {
    user: {
      id: string
      accountId: string
      accountRole: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    accountId?: string
    accountRole?: string
  }
}

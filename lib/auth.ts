import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { isOverLimit, consume } from "@/lib/rate-limit"

// Brute-force protection: throttle repeated failed sign-in attempts per email
// (and per IP via the request headers). Limits are modest to avoid locking out
// legit users but stop dictionary/credential-stuffing attacks.
const LOGIN_FAIL_LIMIT = 8
const LOGIN_FAIL_WINDOW_MS = 5 * 60 * 1000 // 5 min

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, req) => {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : ""
        const password =
          typeof credentials?.password === "string" ? credentials.password : ""
        if (!email || !password) return null

        // Enforce login rate limiting. First a cheap, non-consuming check BEFORE
        // bcrypt so attackers can't burn CPU; then consume() only on an actual
        // failed attempt so legitimate repeated sign-ins aren't throttled.
        const headers = req?.headers as Headers | undefined
        const ip =
          headers
            ?.get("x-forwarded-for")
            ?.split(",")[0]
            ?.trim() || "unknown"
        const emailKey = `login:${email}`
        const ipKey = `loginip:${ip}`
        if (isOverLimit(emailKey, LOGIN_FAIL_LIMIT)) {
          return null
        }
        if (isOverLimit(ipKey, LOGIN_FAIL_LIMIT * 4)) {
          return null
        }

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          consume(emailKey, LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_MS)
          consume(ipKey, LOGIN_FAIL_LIMIT * 4, LOGIN_FAIL_WINDOW_MS)
          return null
        }

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) {
          consume(emailKey, LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_MS)
          consume(ipKey, LOGIN_FAIL_LIMIT * 4, LOGIN_FAIL_WINDOW_MS)
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          accountId: user.accountId,
          accountRole: user.accountRole,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.accountId = user.accountId
        token.accountRole = user.accountRole
      }
      // Always refresh membership + role from the database so that accepting an
      // invitation (which moves a user to another account) and role changes take
      // effect on the next request without forcing a re-login. Otherwise the JWT
      // keeps the pre-acceptance accountId/role and the user sees the wrong
      // workspace's data and the wrong menu options.
      if (typeof token.id === "string" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            id: true,
            name: true,
            email: true,
            accountId: true,
            accountRole: true,
          },
        })
        if (fresh) {
          token.accountId = fresh.accountId
          token.accountRole = fresh.accountRole
          token.name = fresh.name
          token.email = fresh.email
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : ""
        session.user.accountId =
          typeof token.accountId === "string" ? token.accountId : ""
        session.user.accountRole =
          typeof token.accountRole === "string" ? token.accountRole : "AGENT"
      }
      return session
    },
  },
})

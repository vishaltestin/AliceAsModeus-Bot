import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { safeNext } from "@/lib/navigation"

const protectedPrefixes = [
  "/dashboard",
  "/profile",
  "/inbox",
  "/contacts",
  "/pipelines",
  "/broadcasts",
  "/automations",
  "/settings",
  "/platform-admin",
]

const authPages = new Set(["/login", "/signup"])

export default auth((request: NextRequest & { auth: unknown }) => {
  const { pathname, search } = request.nextUrl
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
  const isAuthPage = authPages.has(pathname)
  const isAuthenticated = Boolean(request.auth)

  if (isProtectedRoute && !isAuthenticated) {
    const isPlatformAdminRoute =
      pathname === "/platform-admin" || pathname.startsWith("/platform-admin/")
    const loginUrl = new URL(
      isPlatformAdminRoute ? "/admin/login" : "/login",
      request.url
    )
    loginUrl.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(
      new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url)
    )
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}

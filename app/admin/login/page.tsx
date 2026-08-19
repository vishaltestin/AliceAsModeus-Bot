import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isPlatformAdmin } from "@/lib/permissions"
import { AdminLoginForm } from "./admin-login-form"

export default async function AdminLoginPage() {
  const session = await auth()
  if (session?.user) {
    // Already signed in — admins go to the console, everyone else to the app.
    redirect(isPlatformAdmin(session.user.accountRole) ? "/platform-admin" : "/dashboard")
  }
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-10"
      style={{ background: "var(--paper)" }}
    >
      <div className="w-full max-w-md">
        <AdminLoginForm />
      </div>
    </div>
  )
}

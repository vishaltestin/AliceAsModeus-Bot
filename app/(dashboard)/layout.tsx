import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardShell } from "./dashboard-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardShell
      user={{
        name: session.user.name,
        email: session.user.email,
        accountRole: session.user.accountRole,
      }}
    >
      {children}
    </DashboardShell>
  )
}

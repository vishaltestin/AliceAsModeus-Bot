import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isPlatformAdmin } from "@/lib/permissions"
import { PlatformSidebar } from "./platform-nav"
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar"

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/admin/login")
  if (!isPlatformAdmin(session.user.accountRole)) redirect("/inbox")

  return (
    <SidebarProvider>
      <PlatformSidebar />
      <SidebarInset className="bg-[var(--paper)]">
        <main className="h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

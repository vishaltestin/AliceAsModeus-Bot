import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ProfileClient } from "./profile-client"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user) redirect("/login?next=/profile")
  const account = await prisma.account.findUnique({
    where: { id: session.user.accountId },
    select: { name: true },
  })
  return (
    <ProfileClient
      user={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.accountRole,
        accountName: account?.name ?? "Workspace",
      }}
    />
  )
}

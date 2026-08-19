import { auth } from "@/lib/auth"
import { safeNext } from "@/lib/navigation"
import { redirect } from "next/navigation"
import { LoginForm } from "./login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] | undefined }>
}) {
  const params = await searchParams
  const next = safeNext(typeof params.next === "string" ? params.next : null)
  const session = await auth()

  if (session?.user) {
    redirect(next)
  }

  return <LoginForm next={next} />
}

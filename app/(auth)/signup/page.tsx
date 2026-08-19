import { auth } from "@/lib/auth"
import { safeNext } from "@/lib/navigation"
import { redirect } from "next/navigation"
import { SignupForm } from "./signup-form"

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] | undefined }>
}) {
  const params = await searchParams
  const next = safeNext(typeof params.next === "string" ? params.next : null)
  const session = await auth()

  if (session?.user) {
    // If the user is already signed in, respect the intended destination. For
    // an invitation this routes them to the join page; otherwise to the next
    // safe page (defaulting to the inbox).
    redirect(next)
  }

  return <SignupForm next={next} />
}

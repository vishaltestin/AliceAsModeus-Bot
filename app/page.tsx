import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

// The marketing home page is intentionally removed. Users land directly on the
// app from the main website, so the root simply routes them to the sign-in
// screen (or the inbox if they're already authenticated).
export default async function Page() {
  const session = await auth()
  redirect(session?.user ? "/dashboard" : "/login")
}

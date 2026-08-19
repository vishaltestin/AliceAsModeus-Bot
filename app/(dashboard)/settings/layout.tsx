import { auth } from "@/lib/auth"
import { isAdminRole, roleLabel } from "@/lib/permissions"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login?next=/settings/team")

  if (!isAdminRole(session.user.accountRole)) {
    return (
      <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-xl"
            style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
          >
            <span aria-hidden="true">⌁</span>
          </div>
          <p
            className="mt-6 text-xs font-semibold tracking-[0.16em] uppercase"
            style={{ color: "var(--amber)" }}
          >
            Administrator access
          </p>
          <h1
            className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            Settings are protected.
          </h1>
          <p
            className="mt-3 text-sm leading-6"
            style={{ color: "var(--ink-soft)" }}
          >
            You are signed in as a{" "}
            {roleLabel(session.user.accountRole).toLowerCase()}. Ask an owner or
            administrator to manage workspace settings.
          </p>
          <Link
            href="/inbox"
            className="mt-8 inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            style={{
              background: "var(--jade)",
              boxShadow: "0 8px 18px rgba(31, 111, 92, 0.18)",
            }}
          >
            Return to inbox
          </Link>
        </div>
      </div>
    )
  }

  return children
}

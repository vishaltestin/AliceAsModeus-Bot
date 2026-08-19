"use client"

import { use, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { peekInvitation, acceptInvitation } from "./actions"

export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()
  const [info, setInfo] = useState<{
    accountName?: string
    role?: string
    error?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    peekInvitation(token).then(setInfo)
  }, [token])

  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptInvitation(token)
      if (result?.error === "unauthenticated") {
        // Send them to the invitation-aware signup so they don't create a
        // throwaway personal workspace just to join this one. Existing users
        // can switch to sign-in from there.
        router.push(`/signup?next=/join/${encodeURIComponent(token)}`)
        return
      }
      if (result?.error) return setError(result.error)
      router.push("/dashboard")
    })
  }

  if (!info)
    return (
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        Loading…
      </p>
    )
  if (info.error)
    return (
      <p className="text-sm" style={{ color: "var(--coral)" }}>
        {info.error}
      </p>
    )

  return (
    <div>
      <h1
        className="font-[family-name:var(--font-display)] text-2xl font-medium"
        style={{ color: "var(--ink)" }}
      >
        Join {info.accountName}
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
        You&apos;ve been invited as <strong>{info.role}</strong>.
      </p>
      {error && (
        <p
          className="mt-4 rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
        >
          {error}
        </p>
      )}
      <button
        onClick={handleAccept}
        disabled={isPending}
        className="mt-6 w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--jade)" }}
      >
        {isPending ? "Joining…" : "Accept invitation"}
      </button>
    </div>
  )
}

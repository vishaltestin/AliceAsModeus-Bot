"use client"

import { KeyRound, ShieldCheck, UserRound } from "lucide-react"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { changePassword } from "./actions"

export function ProfileClient({
  user,
}: {
  user: {
    name: string | null | undefined
    email: string | null | undefined
    role: string
    accountName: string
  }
}) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      try {
        const result = await changePassword(
          currentPassword,
          newPassword,
          confirmPassword
        )
        if (result.error) setError(result.error)
        else {
          setSuccess(true)
          setCurrentPassword("")
          setNewPassword("")
          setConfirmPassword("")
        }
      } catch (reason) {
        console.error("[wacrm] Change password failed", reason)
        setError("We couldn't change your password. Please try again.")
      }
    })
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile & security"
        description="Manage your workspace identity and keep your sign-in secure."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="surface-card p-5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "var(--jade-soft)",
              color: "var(--jade-dark)",
            }}
          >
            <UserRound size={18} />
          </span>
          <p
            className="mt-4 text-[11px] font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--ink-soft)" }}
          >
            Your profile
          </p>
          <p
            className="mt-1 text-lg font-semibold"
            style={{ color: "var(--ink)" }}
          >
            {user.name || "Unnamed teammate"}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            {user.email}
          </p>
          <p className="mt-3 text-xs" style={{ color: "var(--jade-dark)" }}>
            {user.role} · {user.accountName}
          </p>
        </div>
        <div className="surface-card p-5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
          >
            <ShieldCheck size={18} />
          </span>
          <p
            className="mt-4 text-[11px] font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--ink-soft)" }}
          >
            Security
          </p>
          <p
            className="mt-1 text-sm font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Credentials protected
          </p>
          <p
            className="mt-1 text-xs leading-5"
            style={{ color: "var(--ink-soft)" }}
          >
            Passwords are hashed and account activity is recorded in the audit
            log.
          </p>
        </div>
      </div>
      <div className="surface-card p-5 sm:p-6">
        <div
          className="flex items-start gap-3 border-b pb-5"
          style={{ borderColor: "var(--line)" }}
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "var(--jade-soft)",
              color: "var(--jade-dark)",
            }}
          >
            <KeyRound size={18} />
          </span>
          <div>
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Change password
            </h2>
            <p
              className="mt-1 text-xs leading-5"
              style={{ color: "var(--ink-soft)" }}
            >
              Use a unique password of at least eight characters.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FormField
            label="Current password"
            htmlFor="current-password"
            required
          >
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </FormField>
          <div className="hidden sm:block" />
          <FormField label="New password" htmlFor="new-password" required>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </FormField>
          <FormField
            label="Confirm new password"
            htmlFor="confirm-password"
            required
          >
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </FormField>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl px-3.5 py-3 text-sm"
            style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="mt-4 rounded-xl px-3.5 py-3 text-sm"
            style={{
              background: "var(--jade-soft)",
              color: "var(--jade-dark)",
            }}
          >
            Password changed successfully.
          </div>
        )}
        <div
          className="mt-5 flex justify-end border-t pt-5"
          style={{ borderColor: "var(--line)" }}
        >
          <Button
            onClick={submit}
            disabled={
              isPending || !currentPassword || !newPassword || !confirmPassword
            }
          >
            {isPending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </div>
    </div>
  )
}

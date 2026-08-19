"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { AuthField } from "../auth-field"
import { resetPassword } from "../forgot-password/actions"

const resetSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      })
    }
  })

type ResetValues = z.infer<typeof resetSchema>

export function ResetPasswordForm({ token }: { token: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    setValue,
    clearErrors,
    setError: setFieldError,
    formState: { errors },
  } = useForm<ResetValues>({
    shouldFocusError: false,
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  async function submit() {
    if (submitting) return
    setError(null)
    const form = formRef.current
    if (!form) return

    const fd = new FormData(form)
    const password = String(fd.get("password") ?? "")
    const confirmPassword = String(fd.get("confirmPassword") ?? "")

    const parsed = resetSchema.safeParse({ password, confirmPassword })
    if (!parsed.success) {
      setValue("password", password, { shouldValidate: true })
      setValue("confirmPassword", confirmPassword, { shouldValidate: true })
      const fe = parsed.error.flatten().fieldErrors
      if (fe.password?.[0]) setFieldError("password", { message: fe.password[0] })
      if (fe.confirmPassword?.[0])
        setFieldError("confirmPassword", { message: fe.confirmPassword[0] })
      return
    }

    clearErrors()
    setSubmitting(true)
    try {
      const result = await resetPassword(token, parsed.data.password, parsed.data.confirmPassword)
      if (result.error) setError(result.error)
      else setSuccess(true)
    } catch (reason) {
      console.error("[wacrm] Reset password form failed", reason)
      setError("We couldn't reset your password. Please request a new link.")
    } finally {
      setSubmitting(false)
    }
  }

  // Prevent native form submission (Enter key) from reloading the page.
  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit()
  }

  if (success)
    return (
      <div className="text-center">
        <p className="eyebrow">Password updated</p>
        <h1 className="page-title mt-2">You&apos;re ready to sign in.</h1>
        <p
          className="mt-3 text-sm leading-6"
          style={{ color: "var(--ink-soft)" }}
        >
          Your new password is active. Use it the next time you enter your
          workspace.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: "var(--jade)" }}
        >
          Return to sign in
        </Link>
      </div>
    )

  return (
    <div>
      <p className="eyebrow">Account recovery</p>
      <h1 className="page-title mt-2">Choose a new password.</h1>
      <p
        className="mt-3 text-sm leading-6"
        style={{ color: "var(--ink-soft)" }}
      >
        Use at least eight characters. This reset link can only be used once.
      </p>
      <form ref={formRef} onSubmit={handleFormSubmit} noValidate className="mt-8 space-y-5">
        <AuthField
          label="New password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          required
          autoComplete="new-password"
          minLength={8}
          register={register("password")}
          error={errors.password?.message}
          hint="Choose a password you do not reuse elsewhere."
        />
        <AuthField
          label="Confirm password"
          name="confirmPassword"
          type="password"
          placeholder="Repeat your password"
          required
          autoComplete="new-password"
          register={register("confirmPassword")}
          error={errors.confirmPassword?.message}
        />
        {error && (
          <div
            role="alert"
            className="rounded-xl px-3.5 py-3 text-sm"
            style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || !token}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--jade)" }}
        >
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
      <p
        className="mt-7 text-center text-sm"
        style={{ color: "var(--ink-soft)" }}
      >
        <Link
          href="/login"
          className="font-semibold"
          style={{ color: "var(--jade)" }}
        >
          Back to sign in
        </Link>
      </p>
    </div>
  )
}

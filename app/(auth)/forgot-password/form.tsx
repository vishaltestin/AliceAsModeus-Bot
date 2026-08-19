"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { requestPasswordReset } from "./actions"
import { AuthField } from "../auth-field"

const forgotSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your work email.")
    .email("Enter a valid email address."),
})

type ForgotValues = z.infer<typeof forgotSchema>

export function ForgotPasswordForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [devResetUrl, setDevResetUrl] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    setValue,
    clearErrors,
    setError: setFieldError,
    formState: { errors },
  } = useForm<ForgotValues>({
    shouldFocusError: false,
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  })

  async function submit() {
    if (submitting) return
    setMessage(null)
    setDevResetUrl(undefined)
    const form = formRef.current
    if (!form) return

    const fd = new FormData(form)
    const email = String(fd.get("email") ?? "")

    const parsed = forgotSchema.safeParse({ email })
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors
      setValue("email", email, { shouldValidate: true })
      if (fe.email?.[0]) setFieldError("email", { message: fe.email[0] })
      return
    }

    clearErrors()
    setSubmitting(true)
    try {
      const result = await requestPasswordReset(parsed.data.email)
      setMessage(
        result.message ??
          "If an account exists for that email, we sent reset instructions."
      )
      setDevResetUrl(result.devResetUrl)
    } catch (reason) {
      console.error("[wacrm] Forgot password form failed", reason)
      setMessage("We couldn't process that request. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Prevent native form submission (Enter key) from reloading the page.
  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit()
  }

  return (
    <div>
      <p className="eyebrow">Account recovery</p>
      <h1 className="page-title mt-2">Reset your password.</h1>
      <p
        className="mt-3 text-sm leading-6"
        style={{ color: "var(--ink-soft)" }}
      >
        Enter your work email and we&apos;ll send a secure reset link if an
        account exists.
      </p>
      <form ref={formRef} onSubmit={handleFormSubmit} noValidate className="mt-8 space-y-5">
        <AuthField
          label="Work email"
          name="email"
          type="email"
          placeholder="you@company.com"
          required
          autoComplete="email"
          register={register("email")}
          error={errors.email?.message}
        />
        {message && (
          <div
            role="status"
            className="rounded-xl px-3.5 py-3 text-sm"
            style={{
              background: "var(--jade-soft)",
              color: "var(--jade-dark)",
            }}
          >
            {message}
            {devResetUrl && (
              <a
                className="mt-2 block font-[family-name:var(--font-code)] text-[11px] break-all underline"
                href={devResetUrl}
              >
                Development reset link
              </a>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--jade)" }}
        >
          {submitting ? "Sending…" : "Send reset link"}
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

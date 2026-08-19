"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { AuthField } from "../auth-field"

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your work email.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm({ next }: { next: string }) {
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    setValue,
    clearErrors,
    setError: setFieldError,
    formState: { errors },
  } = useForm<LoginValues>({
    shouldFocusError: false,
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function submitLogin() {
    if (submitting) return
    setError(null)

    // Read values directly from the DOM inputs so browser-autofilled fields
    // (which don't fire React change events) are picked up correctly.
    const email = (emailRef.current?.value ?? "").trim()
    const password = passwordRef.current?.value ?? ""

    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors
      setValue("email", email, { shouldValidate: true })
      setValue("password", password, { shouldValidate: true })
      if (fe.email?.[0]) setFieldError("email", { message: fe.email[0] })
      if (fe.password?.[0]) setFieldError("password", { message: fe.password[0] })
      return
    }

    // Clear any previous field errors now that the input is valid.
    clearErrors()

    setSubmitting(true)
    try {
      const result = await signIn("credentials", {
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
        redirect: false,
      })

      // Note: `result.ok` reflects the HTTP status of the callback endpoint,
      // which returns 200 even on failed auth. The real failure is signaled by
      // `result.error`, so we must check that FIRST to avoid navigating away on
      // a failed sign-in.
      if (result?.error) {
        setError(
          result.error === "CredentialsSignin"
            ? "The email or password is incorrect."
            : "We couldn't sign you in. Please try again."
        )
        return
      }
      if (!result?.ok) {
        setError("We couldn't sign you in. Please try again.")
        return
      }

      window.location.assign(next)
    } catch (reason) {
      console.error("[wacrm] Login failed", reason)
      setError("We couldn't reach the sign-in service. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Prevent the browser's native form submission (button click OR Enter key)
  // from reloading the page — always go through submitLogin().
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitLogin()
  }

  return (
    <div>
      <div className="mb-8">
        <p
          className="mb-3 text-xs font-semibold tracking-[0.16em] uppercase"
          style={{ color: "var(--jade)" }}
        >
          Welcome back
        </p>
        <h1
          className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight"
          style={{ color: "var(--ink)" }}
        >
          Your conversations, ready.
        </h1>
        <p
          className="mt-2 text-sm leading-6"
          style={{ color: "var(--ink-soft)" }}
        >
          Sign in to continue managing your shared WhatsApp inbox.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField
          label="Work email"
          name="email"
          type="email"
          placeholder="you@company.com"
          required
          autoComplete="email"
          ref={emailRef}
          error={errors.email?.message}
        />
        <div>
          <AuthField
            label="Password"
            name="password"
            type="password"
            placeholder="Your password"
            required
            autoComplete="current-password"
            ref={passwordRef}
            error={errors.password?.message}
          />
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-xs font-semibold"
              style={{ color: "var(--jade)" }}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm"
            style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
          >
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: "var(--coral)", color: "white" }}
            >
              !
            </span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "var(--jade)",
            boxShadow: "0 10px 22px rgba(31, 111, 92, 0.18)",
          }}
        >
          {submitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          {submitting ? "Signing you in…" : "Sign in"}
        </button>
      </form>

      <p
        className="mt-7 text-center text-sm"
        style={{ color: "var(--ink-soft)" }}
      >
        New here?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold"
          style={{ color: "var(--jade)" }}
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}

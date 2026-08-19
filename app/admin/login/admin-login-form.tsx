"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn, signOut } from "next-auth/react"
import { Lock, ShieldCheck } from "lucide-react"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { AuthField } from "@/app/(auth)/auth-field"

const adminLoginSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your email.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

type AdminLoginValues = z.infer<typeof adminLoginSchema>

export function AdminLoginForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    setValue,
    clearErrors,
    setError: setFieldError,
    formState: { errors },
  } = useForm<AdminLoginValues>({
    shouldFocusError: false,
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function submitLogin() {
    if (submitting) return
    setError(null)
    const form = formRef.current
    if (!form) return

    const fd = new FormData(form)
    const email = String(fd.get("email") ?? "").trim()
    const password = String(fd.get("password") ?? "")

    const parsed = adminLoginSchema.safeParse({ email, password })
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors
      setValue("email", email, { shouldValidate: true })
      setValue("password", password, { shouldValidate: true })
      if (fe.email?.[0]) setFieldError("email", { message: fe.email[0] })
      if (fe.password?.[0]) setFieldError("password", { message: fe.password[0] })
      return
    }

    clearErrors()
    setSubmitting(true)
    try {
      const result = await signIn("credentials", {
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
        redirect: false,
      })

      // `result.ok` reflects the HTTP status (200 even on failed auth); the
      // real failure is in `result.error`, so check it FIRST.
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

      // Confirm this account actually has platform-admin access. If not, sign
      // them back out so a regular customer account can't enter the console.
      const res = await fetch("/api/auth/session")
      const session = await res.json()
      if (session?.user?.accountRole !== "SUPER_ADMIN") {
        await signOut({ redirect: false })
        setError("This account does not have platform admin access.")
        return
      }
      router.replace("/platform-admin")
      router.refresh()
    } catch (reason) {
      console.error("[admin] login failed", reason)
      setError("We couldn't reach the sign-in service. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Prevent native form submission (Enter key) from reloading the page.
  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitLogin()
  }

  return (
    <div
      className="overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5"
      style={{ background: "var(--paper-raised)" }}
    >
      <div
        className="flex flex-col items-center gap-1 border-b px-6 py-5"
        style={{ borderColor: "var(--line)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fueledinbox-logo.png"
          alt="FueledInbox"
          className="h-10 w-auto shrink-0"
          style={{ objectFit: "contain" }}
        />
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
          Platform Admin
        </h1>
      </div>

      <div className="px-6 py-6">
        <p
          className="mb-1 text-xs font-semibold tracking-[0.16em] uppercase"
          style={{ color: "var(--brand-blue)" }}
        >
          Restricted access
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight" style={{ color: "var(--ink)" }}>
          Sign in to the console
        </h2>
        <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
          This is the platform-wide control center. Only authorized administrators
          can continue.
        </p>

        <form ref={formRef} onSubmit={handleFormSubmit} noValidate className="mt-6 space-y-4">
          <AuthField
            label="Admin email"
            name="email"
            type="email"
            placeholder="admin@your-platform.com"
            required
            autoComplete="email"
            register={register("email")}
            error={errors.email?.message}
          />
          <AuthField
            label="Password"
            name="password"
            type="password"
            placeholder="Your password"
            required
            autoComplete="current-password"
            register={register("password")}
            error={errors.password?.message}
          />

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm"
              style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
            >
              <Lock size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "linear-gradient(120deg, var(--brand-navy), var(--brand-blue))",
              boxShadow: "0 10px 22px rgba(10, 59, 158, 0.22)",
            }}
          >
            {submitting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {submitting ? "Verifying access…" : "Sign in to console"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--line)" }}>
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
            <ShieldCheck size={13} style={{ color: "var(--jade)" }} />
            Role-protected
          </span>
          <Link href="/login" className="text-xs font-semibold" style={{ color: "var(--jade)" }}>
            Customer sign-in →
          </Link>
        </div>
      </div>
    </div>
  )
}

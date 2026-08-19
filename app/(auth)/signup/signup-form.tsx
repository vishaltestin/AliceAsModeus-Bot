"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { AuthField } from "../auth-field"
import { signup } from "./actions"

// Derive the invitation token from a "/join/TOKEN" next path, if present.
function joinTokenFromNext(next: string): string {
  const match = next.match(/^\/join\/(.+)$/)
  return match ? match[1] : ""
}

export function SignupForm({ next }: { next: string }) {
  const joinToken = joinTokenFromNext(next)
  const isJoin = Boolean(joinToken)

  const signupSchema = z
    .object({
      name: z.string().min(2, "Use at least 2 characters."),
      email: z.string().min(1, "Enter your work email.").email("Enter a valid email address."),
      password: z.string().min(8, "Use at least 8 characters."),
      confirmPassword: z.string().min(1, "Please confirm your password."),
      accountName: isJoin
        ? z.string().optional()
        : z.string().min(2, "Use at least 2 characters."),
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

  type SignupValues = z.infer<typeof signupSchema>

  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    setValue,
    clearErrors,
    setError: setFieldError,
    formState: { errors },
  } = useForm<SignupValues>({
    shouldFocusError: false,
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      accountName: "",
    },
  })

  async function doSignup() {
    if (submitting) return
    setError(null)
    const form = formRef.current
    if (!form) return

    // Read values from the native form so browser-autofilled fields are picked
    // up correctly.
    const fd = new FormData(form)
    const values: SignupValues = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      confirmPassword: String(fd.get("confirmPassword") ?? ""),
      accountName: String(fd.get("accountName") ?? ""),
    }

    const parsed = signupSchema.safeParse(values)
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors
      ;(Object.keys(values) as (keyof SignupValues)[]).forEach((field) => {
        setValue(field, values[field], { shouldValidate: true })
        if (fe[field]?.[0]) setFieldError(field, { message: fe[field][0] })
      })
      return
    }

    clearErrors()
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set("name", parsed.data.name)
      formData.set("email", parsed.data.email)
      formData.set("password", parsed.data.password)
      formData.set("confirmPassword", parsed.data.confirmPassword)
      if (parsed.data.accountName) formData.set("accountName", parsed.data.accountName)
      const result = await signup(formData, joinToken)

      if (result?.fieldErrors) {
        const serverFieldErrors = result.fieldErrors as Record<
          string,
          string[] | undefined
        >
        for (const [field, messages] of Object.entries(serverFieldErrors)) {
          if (messages?.[0]) {
            setFieldError(field as keyof SignupValues, { message: messages[0] })
          }
        }
      }
      if (result?.error) {
        setError(result.error)
        return
      }

      const signInResult = await signIn("credentials", {
        email: parsed.data.email.trim().toLowerCase(),
        password: parsed.data.password,
        redirect: false,
      })
      // Check `signInResult.error` FIRST — `ok` is true even on failed auth.
      if (signInResult?.error || !signInResult?.ok) {
        setError("Your account was created. Please sign in to continue.")
        return
      }

      // When joining via an invitation the user already belongs to the
      // workspace, so land them straight in the inbox rather than back on the
      // join page (which would say they're already a member).
      window.location.assign(isJoin ? "/dashboard" : next)
    } catch (reason) {
      console.error("[wacrm] Signup failed", reason)
      setError("We couldn't create your account right now. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Prevent native form submission (Enter key) from reloading the page.
  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void doSignup()
  }

  return (
    <div>
      <div className="mb-7">
        <p
          className="mb-3 text-xs font-semibold tracking-[0.16em] uppercase"
          style={{ color: "var(--jade)" }}
        >
          {isJoin ? "Join your team" : "Start your workspace"}
        </p>
        <h1
          className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight"
          style={{ color: "var(--ink)" }}
        >
          {isJoin
            ? "You've been invited."
            : "Bring your team together."}
        </h1>
        <p
          className="mt-2 text-sm leading-6"
          style={{ color: "var(--ink-soft)" }}
        >
          {isJoin
            ? "Create your account and you'll be added straight to your team's shared inbox."
            : "Create your shared inbox and keep every customer conversation moving."}
        </p>
      </div>

      <form ref={formRef} onSubmit={handleFormSubmit} noValidate className="space-y-4">
        <AuthField
          label="Your name"
          name="name"
          placeholder="Jordan Lee"
          required
          autoComplete="name"
          register={register("name")}
          error={errors.name?.message}
        />
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
        <AuthField
          label="Password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          required
          autoComplete="new-password"
          minLength={8}
          register={register("password")}
          error={errors.password?.message}
          hint={
            !errors.password ? "Use a password you will not reuse elsewhere." : undefined
          }
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
        {!isJoin && (
          <AuthField
            label="Team name"
            name="accountName"
            placeholder="Acme Support"
            required
            autoComplete="organization"
            register={register("accountName")}
            error={errors.accountName?.message}
          />
        )}

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
          {submitting
            ? isJoin
              ? "Joining your team…"
              : "Creating your workspace…"
            : isJoin
              ? "Join your team"
              : "Create account"}
        </button>
      </form>

      <p
        className="mt-7 text-center text-sm"
        style={{ color: "var(--ink-soft)" }}
      >
        {isJoin ? "Already have an account? " : "Already have an account? "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-semibold"
          style={{ color: "var(--jade)" }}
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}

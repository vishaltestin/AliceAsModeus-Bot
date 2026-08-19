"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import type { UseFormRegisterReturn } from "react-hook-form"

export function AuthField({
  label,
  name,
  type = "text",
  placeholder,
  required,
  minLength,
  autoComplete,
  // react-hook-form mode: pass the resolved per-field registration, i.e.
  // `register("email")` from useForm.
  register,
  // uncontrolled mode: read the value from the DOM at submit time (handles
  // browser autofill, which doesn't fire change events).
  ref,
  // controlled mode (legacy):
  value,
  onChange,
  // Optional Enter-key handler (used to submit a non-<form> auth layout).
  onKeyDown,
  error,
  hint,
}: {
  label: string
  name: string
  type?: string
  placeholder: string
  required?: boolean
  minLength?: number
  autoComplete?: string
  register?: UseFormRegisterReturn
  ref?: React.Ref<HTMLInputElement>
  value?: string
  onChange?: (value: string) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  error?: string
  hint?: string
}) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === "password"
  const inputType = isPassword && visible ? "text" : type
  const descriptionId = `${name}-description`

  return (
    <label className="block">
      <span
        className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium"
        style={{ color: "var(--ink)" }}
      >
        <span>{label}</span>
        {required && (
          <span
            className="text-[11px] font-normal"
            style={{ color: "var(--ink-soft)" }}
          >
            Required
          </span>
        )}
      </span>
      <span className="relative block">
        <input
          id={name}
          name={name}
          type={inputType}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          ref={register ? register.ref : ref}
          value={register || value === undefined ? undefined : value}
          onChange={
            register
              ? register.onChange
              : onChange
                ? (event) => onChange(event.target.value)
                : undefined
          }
          onBlur={register ? register.onBlur : undefined}
          onKeyDown={onKeyDown}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? descriptionId : undefined}
          className="auth-field w-full rounded-xl px-3.5 py-3 text-sm transition outline-none"
          data-invalid={Boolean(error)}
          style={{
            border: `1px solid ${error ? "var(--coral)" : "var(--line)"}`,
            background: "var(--paper-raised)",
            color: "var(--ink)",
            paddingRight: isPassword ? "2.8rem" : undefined,
          }}
        />
        {isPassword && (
          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5"
            style={{ color: "var(--ink-soft)" }}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </span>
      {(error || hint) && (
        <span
          id={descriptionId}
          className="mt-1.5 block text-xs"
          style={{ color: error ? "var(--coral)" : "var(--ink-soft)" }}
        >
          {error || hint}
        </span>
      )}
    </label>
  )
}

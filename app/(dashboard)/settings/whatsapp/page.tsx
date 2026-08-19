"use client"

import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import {
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  KeyRound,
  Phone,
  RefreshCw,
  ShieldCheck,
  Webhook,
} from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import {
  getWhatsAppConfig,
  getWhatsAppSetupUrls,
  saveWhatsAppConfig,
  verifyWhatsAppConnection,
} from "./actions"

type WhatsAppConfig = Awaited<ReturnType<typeof getWhatsAppConfig>>

export default function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<WhatsAppConfig>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [setupUrls, setSetupUrls] = useState<{
    baseUrl: string
    webhookUrl: string
    webhookReady: boolean
  } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    getWhatsAppConfig()
      .then((nextConfig) => {
        if (active) setConfig(nextConfig)
      })
      .catch((reason) => {
        console.error("[wacrm] WhatsApp settings load failed", reason)
        if (active)
          setError("We couldn't load WhatsApp settings. Please try again.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    getWhatsAppSetupUrls()
      .then(setSetupUrls)
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  async function copyWebhook() {
    if (!setupUrls?.webhookUrl) return
    try {
      await navigator.clipboard.writeText(setupUrls.webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      try {
        const result = await saveWhatsAppConfig(formData)
        if (result.error) {
          setError(result.error)
          return
        }
        setSuccess("Settings saved and credentials verified with Meta.")
        setConfig(await getWhatsAppConfig())
      } catch (reason) {
        console.error("[wacrm] WhatsApp settings save failed", reason)
        setError("We couldn't save these settings. Please try again.")
      }
    })
  }

  function handleVerify() {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      try {
        const result = await verifyWhatsAppConnection()
        if (result.error) {
          setError(result.error)
          setConfig(await getWhatsAppConfig())
          return
        }
        setSuccess("Connection verified successfully.")
        setConfig(await getWhatsAppConfig())
      } catch (reason) {
        console.error("[wacrm] WhatsApp verification failed", reason)
        setError("We couldn't verify the connection. Please try again.")
      }
    })
  }

  if (loading) return <WhatsAppSkeleton />

  const isConnected = config?.status === "CONNECTED"

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p
            className="text-xs font-semibold tracking-[0.16em] uppercase"
            style={{ color: "var(--jade)" }}
          >
            Channel settings
          </p>
          <h1
            className="mt-1 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            WhatsApp connection
          </h1>
          <p
            className="mt-2 max-w-xl text-sm leading-6"
            style={{ color: "var(--ink-soft)" }}
          >
            Connect the WhatsApp Business number your team uses to send and
            receive customer conversations.
          </p>
        </div>
        <StatusPill connected={isConnected} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard
          icon={<Phone size={17} />}
          label="Phone number ID"
          value={config?.phoneNumberId || "Not configured"}
        />
        <InfoCard
          icon={<KeyRound size={17} />}
          label="Access token"
          value={
            config?.hasAccessToken ? "Encrypted and stored" : "Not configured"
          }
        />
        <InfoCard
          icon={<ShieldCheck size={17} />}
          label="Webhook token"
          value={config?.hasVerifyToken ? "Configured" : "Not configured"}
        />
        <InfoCard
          icon={<ShieldCheck size={17} />}
          label="Meta App secret"
          value={config?.hasAppSecret ? "Encrypted and stored" : "Not configured"}
        />
      </div>

      {/* Webhook callback */}
      <div className="rounded-2xl p-5 shadow-sm ring-1 ring-black/5 sm:p-6" style={{ background: "var(--paper-raised)" }}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
            <Webhook size={18} />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              Webhook callback URL
            </h2>
            <p className="mt-1 text-xs leading-5" style={{ color: "var(--ink-soft)" }}>
              Enter this URL in Meta for Developers → your app → WhatsApp →
              Configuration. It&apos;s the same for every workspace on this platform.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Input
            readOnly
            value={setupUrls?.webhookUrl ?? "…"}
            onFocus={(e) => e.target.select()}
            className="flex-1 font-[family-name:var(--font-code)] text-xs"
            aria-label="Webhook callback URL"
          />
          <button
            type="button"
            onClick={copyWebhook}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
          >
            <ClipboardCopy size={14} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {setupUrls?.webhookReady ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--jade)" }}>
            <CheckCircle2 size={14} /> Webhook is configured — add the URL above in Meta and subscribe to the{" "}
            <code className="font-[family-name:var(--font-code)]">messages</code> field.
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--amber)" }}>
            <Webhook size={14} /> Set the <strong>Webhook verify token</strong> and{" "}
            <strong>Meta App secret</strong> below, then add this URL in Meta.
          </p>
        )}
      </div>

      {/* Mini setup guide */}
      <div className="rounded-2xl p-5 shadow-sm ring-1 ring-black/5 sm:p-6" style={{ background: "var(--paper-raised)" }}>
        <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ink)" }}>
          <ExternalLink size={15} /> Quick setup guide
        </h2>
        <ol className="mt-4 space-y-3">
          {[
            ["Create a Meta Developer App", "Go to developers.facebook.com → My Apps → Create App, and add the WhatsApp product to it."],
            ["Copy your credentials", "In App settings → App secret, and WhatsApp → API Setup, copy your App secret, Access token, and Phone number ID. Add your WhatsApp Business Account ID too."],
            ["Save them here", "Fill in the fields below and click Save settings. Your access token and app secret are encrypted before storage."],
            ["Add the webhook URL", "Paste the Webhook callback URL (above) into Meta → your app → WhatsApp → Configuration, with a verify token of your choice and Subscribe to the messages field."],
            ["Verify the connection", "Click “Verify connection”. Once Meta validates it, your status flips to Connected and you can start messaging."],
          ].map(([title, desc], i) => (
            <li key={i} className="flex gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: "var(--jade)" }}
              >
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
                <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--ink-soft)" }}>{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <form
        action={handleSubmit}
        className="rounded-2xl p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
        style={{ background: "var(--paper-raised)" }}
      >
        <div
          className="mb-6 flex items-start gap-3 border-b pb-5"
          style={{ borderColor: "var(--line)" }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "var(--jade-soft)",
              color: "var(--jade-dark)",
            }}
          >
            <Phone size={18} />
          </span>
          <div>
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Business API credentials
            </h2>
            <p
              className="mt-1 text-xs leading-5"
              style={{ color: "var(--ink-soft)" }}
            >
              These values are used only on the server. Access tokens are
              encrypted before storage.
            </p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <MonoField
            label="Phone number ID"
            name="phoneNumberId"
            placeholder="109876543212345"
            defaultValue={config?.phoneNumberId ?? ""}
            required
          />
          <MonoField
            label="WhatsApp Business Account ID"
            name="wabaId"
            placeholder="102938475610283"
            defaultValue={config?.wabaId ?? ""}
          />
          <MonoField
            label="Access token"
            name="accessToken"
            type="password"
            placeholder={
              config?.hasAccessToken
                ? "Leave blank to keep current token"
                : "EAAxxxxxxxxxxxxxxx"
            }
            hint="Only enter a new token when rotating credentials."
          />
          <MonoField
            label="Webhook verify token"
            name="verifyToken"
            placeholder={
              config?.hasVerifyToken
                ? "Leave blank to keep current token"
                : "A private verification string"
            }
            hint="Used when Meta verifies your webhook callback."
          />
          <MonoField
            label="Meta App secret"
            name="appSecret"
            type="password"
            placeholder={
              config?.hasAppSecret
                ? "Leave blank to keep current secret"
                : "Your Meta Developer App Secret"
            }
            hint="From Meta for Developers → your app → App settings. Encrypted before storage."
          />
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm"
            style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
          >
            <span
              className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: "var(--coral)" }}
            >
              !
            </span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm"
            style={{
              background: "var(--jade-soft)",
              color: "var(--jade-dark)",
            }}
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div
          className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center"
          style={{ borderColor: "var(--line)" }}
        >
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "var(--jade)",
              boxShadow: "0 8px 18px rgba(31,111,92,0.16)",
            }}
          >
            {isPending && <RefreshCw size={15} className="animate-spin" />}
            {isPending ? "Saving and checking…" : "Save settings"}
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={isPending || !config}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              border: "1px solid var(--line)",
              color: "var(--jade-dark)",
            }}
          >
            <RefreshCw size={15} className={isPending ? "animate-spin" : ""} />{" "}
            Verify connection
          </button>
        </div>
      </form>

      {config?.lastRegistrationError && (
        <div
          className="rounded-2xl p-4"
          style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={16} /> Last verification needs attention
          </p>
          <p className="mt-1 text-xs leading-5">
            {config.lastRegistrationError}
          </p>
        </div>
      )}

      <div
        className="flex items-start gap-3 rounded-2xl p-4"
        style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
      >
        <ExternalLink
          size={16}
          className="mt-0.5 shrink-0"
          style={{ color: "var(--jade)" }}
        />
        <p className="text-xs leading-5" style={{ color: "var(--ink-soft)" }}>
          Find these values in Meta for Developers → your app → WhatsApp → API
          Setup. Your webhook callback must be publicly reachable over HTTPS in
          production.
        </p>
      </div>
    </div>
  )
}

function WhatsAppSkeleton() {
  return (
    <div className="max-w-3xl animate-pulse space-y-5">
      <div className="h-3 w-32 rounded" style={{ background: "var(--line)" }} />
      <div
        className="h-10 w-72 rounded-xl"
        style={{ background: "var(--line)" }}
      />
      <div
        className="h-5 w-[28rem] max-w-full rounded"
        style={{ background: "var(--paper)" }}
      />
      <div
        className="h-32 rounded-2xl"
        style={{ background: "var(--paper-raised)" }}
      />
      <div
        className="h-96 rounded-2xl"
        style={{ background: "var(--paper-raised)" }}
      />
    </div>
  )
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className="rounded-2xl p-4 shadow-sm ring-1 ring-black/5"
      style={{ background: "var(--paper-raised)" }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-xl"
        style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}
      >
        {icon}
      </span>
      <p
        className="mt-3 text-[11px] font-semibold tracking-[0.08em] uppercase"
        style={{ color: "var(--ink-soft)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 truncate text-xs font-medium"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </p>
    </div>
  )
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
      style={{
        background: connected ? "var(--jade-soft)" : "var(--amber-soft)",
        color: connected ? "var(--jade-dark)" : "var(--amber)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: connected ? "var(--jade)" : "var(--amber)" }}
      />
      {connected ? "Connected" : "Not connected"}
    </span>
  )
}

function MonoField({
  label,
  name,
  placeholder,
  defaultValue,
  type = "text",
  required,
  hint,
}: {
  label: string
  name: string
  placeholder: string
  defaultValue?: string
  type?: string
  required?: boolean
  hint?: string
}) {
  return (
    <FormField label={label} htmlFor={name} required={required} hint={hint}>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className="font-[family-name:var(--font-code)] text-xs"
      />
    </FormField>
  )
}

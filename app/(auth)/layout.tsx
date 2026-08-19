import type { ReactNode } from "react"

const messages = [
  {
    from: "customer",
    text: "Hi, do you still have the blue jacket in size M?",
  },
  { from: "agent", text: "Yes! Want me to hold one for pickup?" },
  { from: "customer", text: "Please 🙏 I'll come by after 5" },
  { from: "agent", text: "Done — see you then." },
] as const

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid min-h-screen grid-cols-1 lg:grid-cols-2"
      style={{ background: "var(--paper)" }}
    >
      <div
        className="relative hidden flex-col justify-between overflow-hidden px-14 py-16 lg:flex"
        style={{
          background:
            "linear-gradient(160deg, var(--brand-navy), var(--brand-blue))",
        }}
      >
        <div className="relative z-10">
          <span
            className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 shadow-lg"
            style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.15)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/fueledinbox-logo.png"
              alt="FueledInbox"
              className="h-9 w-auto"
              style={{ objectFit: "contain" }}
            />
          </span>
          <p className="mt-3 max-w-xs text-sm text-white/70">
            Every WhatsApp conversation, in one shared inbox.
          </p>
        </div>

        <div className="relative z-10 max-w-sm space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.from === "agent" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="chat-bubble max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-snug text-white"
                style={{
                  background:
                    m.from === "agent"
                      ? "var(--brand-blue-light)"
                      : "rgba(255,255,255,0.12)",
                  animationDelay: `${i * 0.35 + 0.2}s`,
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-xs text-white/40">
          Built for small teams who live in WhatsApp.
        </p>

        <div
          aria-hidden
          className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full opacity-20"
          style={{ background: "var(--brand-blue-soft)" }}
        />
      </div>

      <div className="flex items-center justify-center px-6 py-12 sm:px-10 sm:py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex flex-col items-center gap-1 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/fueledinbox-logo.png"
              alt="FueledInbox"
              className="h-10 w-auto"
              style={{ objectFit: "contain" }}
            />
            <span
              className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-tight"
              style={{ color: "var(--ink)" }}
            >
              FueledInbox
            </span>
          </div>
          {children}
          <p
            className="mt-10 text-center text-[11px]"
            style={{ color: "var(--ink-soft)" }}
          >
            Your team&apos;s conversations, handled with care.
          </p>
        </div>
      </div>
    </div>
  )
}

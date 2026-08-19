"use client"

import { BookOpen, Code2 } from "lucide-react"

export function ApiReference() {
  return (
    <section
      className="surface-card mt-8 overflow-hidden"
      aria-labelledby="api-reference-title"
    >
      <div
        className="flex items-start gap-3 border-b p-5"
        style={{ borderColor: "var(--line)" }}
      >
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}
        >
          <BookOpen size={18} />
        </span>
        <div>
          <p className="eyebrow">Developer guide</p>
          <h2
            id="api-reference-title"
            className="mt-1 font-[family-name:var(--font-display)] text-xl font-medium"
          >
            API quick reference
          </h2>
          <p
            className="mt-1 text-xs leading-5"
            style={{ color: "var(--ink-soft)" }}
          >
            Use this guide while connecting your integration. The complete
            reference with parameters, error codes, rate limits, and code
            samples is at{" "}
            <a
              href="/settings/api-docs"
              className="font-semibold text-[var(--jade-dark)] underline"
            >
              API Docs
            </a>
            .
          </p>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--line)" }}>
        <details open className="group p-5">
          <summary
            className="cursor-pointer list-none text-sm font-semibold"
            style={{ color: "var(--ink)" }}
          >
            1. Authenticate every request
          </summary>
          <div className="mt-3 space-y-3">
            <p
              className="text-xs leading-5"
              style={{ color: "var(--ink-soft)" }}
            >
              Send an API key as a Bearer token. Start with{" "}
              <code className="font-[family-name:var(--font-code)]">
                GET /api/v1/me
              </code>{" "}
              to confirm the key and account.
            </p>
            <CodeSnippet>
              curl https://your-domain.com/api/v1/me \ -H &quot;Authorization:
              Bearer wacrm_live_...&quot;
            </CodeSnippet>
          </div>
        </details>
        <details className="group p-5">
          <summary
            className="cursor-pointer list-none text-sm font-semibold"
            style={{ color: "var(--ink)" }}
          >
            2. Create or update contacts
          </summary>
          <div className="mt-3 space-y-3">
            <p
              className="text-xs leading-5"
              style={{ color: "var(--ink-soft)" }}
            >
              Requires{" "}
              <code className="font-[family-name:var(--font-code)]">
                contacts:write
              </code>
              . Contacts upsert by normalized phone number.
            </p>
            <CodeSnippet>
              POST /api/v1/contacts
              {`{"phone":"+14155550123","name":"Jordan","category":"PROSPECT"}`}
            </CodeSnippet>
          </div>
        </details>
        <details className="group p-5">
          <summary
            className="cursor-pointer list-none text-sm font-semibold"
            style={{ color: "var(--ink)" }}
          >
            3. Send a customer message
          </summary>
          <div className="mt-3 space-y-3">
            <p
              className="text-xs leading-5"
              style={{ color: "var(--ink-soft)" }}
            >
              Requires{" "}
              <code className="font-[family-name:var(--font-code)]">
                messages:send
              </code>
              . Send a free-form text (restricted by WhatsApp&apos;s 24-hour
              window) or an approved template by passing a{" "}
              <code className="font-[family-name:var(--font-code)]">
                template_id
              </code>{" "}
              — templates bypass the 24-hour window.
            </p>
            <CodeSnippet>
              POST /api/v1/messages
              {`{"phone":"+14155550123","text":"Hello from the team"}`}
              POST /api/v1/messages
              {`{"phone":"+14155550123","template_id":"template_id","template_params":["Jordan"]}`}
            </CodeSnippet>
          </div>
        </details>
        <details className="group p-5">
          <summary
            className="cursor-pointer list-none text-sm font-semibold"
            style={{ color: "var(--ink)" }}
          >
            4. Launch a template broadcast
          </summary>
          <div className="mt-3 space-y-3">
            <p
              className="text-xs leading-5"
              style={{ color: "var(--ink-soft)" }}
            >
              Requires{" "}
              <code className="font-[family-name:var(--font-code)]">
                broadcasts:send
              </code>
              . Variable templates need one variables array per phone.
            </p>
            <CodeSnippet>
              POST /api/v1/broadcasts
              {`{"templateName":"order_update","phones":["+14155550123"],"variables":[["Jordan","#1042"]]}`}
            </CodeSnippet>
          </div>
        </details>
      </div>
    </section>
  )
}

function CodeSnippet({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-3"
      style={{ background: "var(--paper)" }}
    >
      <Code2
        size={14}
        className="mt-0.5 shrink-0"
        style={{ color: "var(--jade)" }}
      />
      <pre
        className="min-w-0 overflow-x-auto font-[family-name:var(--font-code)] text-[11px] leading-5 whitespace-pre-wrap"
        style={{ color: "var(--ink)" }}
      >
        {children}
      </pre>
    </div>
  )
}

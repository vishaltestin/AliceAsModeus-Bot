"use client"

import {
  ArrowDownToLine,
  Check,
  Code2,
  Copy,
  Download,
  FileJson,
  Info,
  KeyRound,
  ListOrdered,
  Server,
  ShieldCheck,
  Terminal,
  TriangleAlert,
} from "lucide-react"
import { useState } from "react"

const BASE_URL = "https://your-wacrm-domain.example.com"

const SCOPES = [
  { scope: "messages:send", desc: "Send WhatsApp text and template messages" },
  { scope: "messages:read", desc: "Read messages and their delivery status" },
  { scope: "contacts:read", desc: "List and read contacts" },
  { scope: "contacts:write", desc: "Create and update contacts" },
  { scope: "conversations:read", desc: "List and read conversations" },
  { scope: "broadcasts:send", desc: "Launch template broadcast campaigns" },
]

const ENDPOINTS: {
  id: string
  method: "GET" | "POST"
  path: string
  title: string
  scope: string
  description: string
  params: { name: string; type: string; required: boolean; desc: string }[]
  requestExample?: string
  responseExample: string
  errors: { code: number; desc: string }[]
  curl: string
  node: string
  python: string
}[] = [
  {
    id: "me",
    method: "GET",
    path: "/api/v1/me",
    title: "Verify a key",
    scope: "none",
    description:
      "Returns the account and the list of scopes granted to this API key. No scope is required, so this is the recommended first request to confirm the key and base URL.",
    params: [],
    responseExample: `{
  "account": { "id": "acc_123", "name": "Acme Workspace" },
  "scopes": ["contacts:read", "messages:send"]
}`,
    errors: [
      { code: 401, desc: "Missing or invalid Authorization header" },
      { code: 500, desc: "Internal error" },
    ],
    curl: `curl "${BASE_URL}/api/v1/me" \\
  -H "Authorization: Bearer $WACRM_API_KEY"`,
    node: `const res = await fetch(\`${BASE_URL}/api/v1/me\`, {
  headers: { Authorization: \`Bearer \${process.env.WACRM_API_KEY}\` }
})
const json = await res.json()`,
    python: `import requests

res = requests.get(
    f"{BASE_URL}/api/v1/me",
    headers={"Authorization": f"Bearer {API_KEY}"},
)
print(res.json())`,
  },
  {
    id: "contacts-list",
    method: "GET",
    path: "/api/v1/contacts",
    title: "List contacts",
    scope: "contacts:read",
    description:
      "Lists contacts in the account, newest first. Supports pagination via the limit query parameter.",
    params: [
      {
        name: "limit",
        type: "integer",
        required: false,
        desc: "Max rows to return (1–200, default 50)",
      },
    ],
    responseExample: `{
  "data": [
    {
      "id": "clx_contact",
      "accountId": "acc_123",
      "name": "Jordan Smith",
      "phone": "+14155550123",
      "phoneNormalized": "14155550123",
      "email": "jordan@example.com",
      "company": "Acme Corp",
      "category": "PROSPECT"
    }
  ]
}`,
    errors: [
      { code: 401, desc: "Missing or invalid Authorization header" },
      { code: 403, desc: "Key is missing the contacts:read scope" },
      { code: 500, desc: "Internal error" },
    ],
    curl: `curl "${BASE_URL}/api/v1/contacts?limit=50" \\
  -H "Authorization: Bearer $WACRM_API_KEY"`,
    node: `const res = await fetch(\`${BASE_URL}/api/v1/contacts?limit=50\`, {
  headers: { Authorization: \`Bearer \${process.env.WACRM_API_KEY}\` }
})
const { data } = await res.json()`,
    python: `import requests

res = requests.get(
    f"{BASE_URL}/api/v1/contacts",
    params={"limit": 50},
    headers={"Authorization": f"Bearer {API_KEY}"},
)
print(res.json())`,
  },
  {
    id: "contacts-create",
    method: "POST",
    path: "/api/v1/contacts",
    title: "Create or update a contact",
    scope: "contacts:write",
    description:
      "Creates a contact, or updates the existing one if the normalized phone number already exists (upsert). Valid categories: LEAD, PROSPECT, CUSTOMER, VIP, OTHER.",
    params: [
      {
        name: "phone",
        type: "string",
        required: true,
        desc: "Phone number with country code",
      },
      { name: "name", type: "string", required: false, desc: "Contact name" },
      { name: "email", type: "string", required: false, desc: "Email address" },
      {
        name: "company",
        type: "string",
        required: false,
        desc: "Company name",
      },
      {
        name: "category",
        type: "string",
        required: false,
        desc: "LEAD | PROSPECT | CUSTOMER | VIP | OTHER (default LEAD)",
      },
    ],
    requestExample: `{
  "phone": "+14155550123",
  "name": "Jordan Smith",
  "email": "jordan@example.com",
  "company": "Acme Corp",
  "category": "PROSPECT"
}`,
    responseExample: `{
  "data": {
    "id": "clx_contact",
    "phone": "+14155550123",
    "phoneNormalized": "14155550123",
    "name": "Jordan Smith",
    "email": "jordan@example.com",
    "category": "PROSPECT"
  }
}`,
    errors: [
      { code: 400, desc: "Missing phone, invalid phone, or invalid category" },
      { code: 401, desc: "Missing or invalid Authorization header" },
      { code: 403, desc: "Key is missing the contacts:write scope" },
      { code: 500, desc: "Internal error" },
    ],
    curl: `curl -X POST "${BASE_URL}/api/v1/contacts" \\
  -H "Authorization: Bearer $WACRM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+14155550123","name":"Jordan Smith","category":"PROSPECT"}'`,
    node: `const res = await fetch(\`${BASE_URL}/api/v1/contacts\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.WACRM_API_KEY}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    phone: "+14155550123",
    name: "Jordan Smith",
    category: "PROSPECT"
  })
})
const json = await res.json()`,
    python: `import requests

res = requests.post(
    f"{BASE_URL}/api/v1/contacts",
    json={"phone": "+14155550123", "name": "Jordan Smith", "category": "PROSPECT"},
    headers={"Authorization": f"Bearer {API_KEY}"},
)
print(res.json())`,
  },
  {
    id: "conversations",
    method: "GET",
    path: "/api/v1/conversations",
    title: "List conversations",
    scope: "conversations:read",
    description:
      "Lists conversations with their linked contact, ordered by most recently updated.",
    params: [
      {
        name: "limit",
        type: "integer",
        required: false,
        desc: "Max rows to return (1–200, default 50)",
      },
    ],
    responseExample: `{
  "data": [
    {
      "id": "clx_conversation",
      "accountId": "acc_123",
      "contact": { "id": "clx_contact", "name": "Jordan Smith", "phone": "+14155550123" },
      "status": "OPEN",
      "updatedAt": "2026-08-06T10:00:00.000Z"
    }
  ]
}`,
    errors: [
      { code: 401, desc: "Missing or invalid Authorization header" },
      { code: 403, desc: "Key is missing the conversations:read scope" },
      { code: 500, desc: "Internal error" },
    ],
    curl: `curl "${BASE_URL}/api/v1/conversations?limit=50" \\
  -H "Authorization: Bearer $WACRM_API_KEY"`,
    node: `const res = await fetch(\`${BASE_URL}/api/v1/conversations\`, {
  headers: { Authorization: \`Bearer \${process.env.WACRM_API_KEY}\` }
})
const { data } = await res.json()`,
    python: `import requests

res = requests.get(
    f"{BASE_URL}/api/v1/conversations",
    headers={"Authorization": f"Bearer {API_KEY}"},
)
print(res.json())`,
  },
  {
    id: "messages-read",
    method: "GET",
    path: "/api/v1/messages",
    title: "Read messages",
    scope: "messages:read",
    description:
      "Reads recent messages across the account, or a single conversation when conversation_id is supplied.",
    params: [
      {
        name: "limit",
        type: "integer",
        required: false,
        desc: "Max rows to return (1–200, default 50)",
      },
      {
        name: "conversation_id",
        type: "string",
        required: false,
        desc: "Filter messages to a single conversation",
      },
    ],
    responseExample: `{
  "data": [
    {
      "id": "clx_message",
      "conversationId": "clx_conversation",
      "senderType": "CUSTOMER",
      "contentType": "TEXT",
      "contentText": "Hello, I have a question",
      "status": "READ",
      "createdAt": "2026-08-06T09:58:00.000Z"
    }
  ]
}`,
    errors: [
      { code: 401, desc: "Missing or invalid Authorization header" },
      { code: 403, desc: "Key is missing the messages:read scope" },
      { code: 404, desc: "Conversation not found" },
      { code: 500, desc: "Internal error" },
    ],
    curl: `curl "${BASE_URL}/api/v1/messages?limit=50" \\
  -H "Authorization: Bearer $WACRM_API_KEY"`,
    node: `const res = await fetch(\`${BASE_URL}/api/v1/messages\`, {
  headers: { Authorization: \`Bearer \${process.env.WACRM_API_KEY}\` }
})
const { data } = await res.json()`,
    python: `import requests

res = requests.get(
    f"{BASE_URL}/api/v1/messages",
    headers={"Authorization": f"Bearer {API_KEY}"},
)
print(res.json())`,
  },
  {
    id: "messages-send-text",
    method: "POST",
    path: "/api/v1/messages",
    title: "Send a text message",
    scope: "messages:send",
    description:
      "Sends free-form text. This is only allowed within WhatsApp's 24-hour customer-service window; outside it the API returns 409. Use a template message instead for anything outside that window.",
    params: [
      {
        name: "phone",
        type: "string",
        required: true,
        desc: "Recipient phone number with country code",
      },
      {
        name: "text",
        type: "string",
        required: true,
        desc: "Free-form message body (for text messages)",
      },
    ],
    requestExample: `{
  "phone": "+14155550123",
  "text": "Thanks for reaching out — our team will be with you shortly."
}`,
    responseExample: `{
  "data": {
    "id": "clx_message",
    "status": "SENT",
    "whatsappMessageId": "wamid.HBgNMTQx..."
  },
  "delivered": true
}`,
    errors: [
      { code: 400, desc: "Missing phone/text or invalid phone number" },
      { code: 401, desc: "Missing or invalid Authorization header" },
      { code: 403, desc: "Key is missing the messages:send scope" },
      { code: 409, desc: "WhatsApp 24-hour window is closed" },
      { code: 502, desc: "WhatsApp delivery failed" },
    ],
    curl: `curl -X POST "${BASE_URL}/api/v1/messages" \\
  -H "Authorization: Bearer $WACRM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+14155550123","text":"Thanks for reaching out!"}'`,
    node: `const res = await fetch(\`${BASE_URL}/api/v1/messages\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.WACRM_API_KEY}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ phone: "+14155550123", text: "Thanks!" })
})
const json = await res.json()`,
    python: `import requests

res = requests.post(
    f"{BASE_URL}/api/v1/messages",
    json={"phone": "+14155550123", "text": "Thanks!"},
    headers={"Authorization": f"Bearer {API_KEY}"},
)
print(res.json())`,
  },
  {
    id: "messages-send-template",
    method: "POST",
    path: "/api/v1/messages",
    title: "Send a template message",
    scope: "messages:send",
    description:
      "Sends an approved message template by id. Templates bypass the 24-hour window, so they work any time. template_params are ordered by the template's {{1}}, {{2}} body variables; omit when the template has none.",
    params: [
      {
        name: "phone",
        type: "string",
        required: true,
        desc: "Recipient phone number with country code",
      },
      {
        name: "template_id",
        type: "string",
        required: true,
        desc: "id of an APPROVED template owned by the account",
      },
      {
        name: "template_params",
        type: "array<string>",
        required: false,
        desc: "Body variables in {{1}}, {{2}} order",
      },
    ],
    requestExample: `{
  "phone": "+14155550123",
  "template_id": "clx_template",
  "template_params": ["Jordan", "#1042"]
}`,
    responseExample: `{
  "data": {
    "id": "clx_message",
    "status": "SENT",
    "whatsappMessageId": "wamid.HBgNMTQx..."
  },
  "delivered": true
}`,
    errors: [
      { code: 400, desc: "Missing phone/template_id or invalid phone number" },
      { code: 401, desc: "Missing or invalid Authorization header" },
      { code: 403, desc: "Key is missing the messages:send scope" },
      { code: 404, desc: "Approved template not found" },
      { code: 502, desc: "WhatsApp delivery failed" },
    ],
    curl: `curl -X POST "${BASE_URL}/api/v1/messages" \\
  -H "Authorization: Bearer $WACRM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+14155550123","template_id":"clx_template","template_params":["Jordan"]}'`,
    node: `const res = await fetch(\`${BASE_URL}/api/v1/messages\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.WACRM_API_KEY}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    phone: "+14155550123",
    template_id: "clx_template",
    template_params: ["Jordan"]
  })
})
const json = await res.json()`,
    python: `import requests

res = requests.post(
    f"{BASE_URL}/api/v1/messages",
    json={"phone": "+14155550123", "template_id": "clx_template", "template_params": ["Jordan"]},
    headers={"Authorization": f"Bearer {API_KEY}"},
)
print(res.json())`,
  },
  {
    id: "broadcasts",
    method: "POST",
    path: "/api/v1/broadcasts",
    title: "Launch a template broadcast",
    scope: "broadcasts:send",
    description:
      "Sends an approved template to up to 1,000 phone numbers. When the template has body variables, variables is a two-dimensional array — one sub-array per phone, ordered by {{1}}, {{2}}, .... Returns a broadcast id and per-recipient sent/failed counts.",
    params: [
      {
        name: "templateName",
        type: "string",
        required: true,
        desc: "Name of an APPROVED template owned by the account",
      },
      {
        name: "language",
        type: "string",
        required: false,
        desc: "Template language code (default en_US)",
      },
      {
        name: "phones",
        type: "array<string>",
        required: true,
        desc: "Recipient phone numbers (max 1,000)",
      },
      {
        name: "variables",
        type: "array<array<string>>",
        required: false,
        desc: "Body variables, one sub-array per phone",
      },
    ],
    requestExample: `{
  "templateName": "order_update",
  "language": "en_US",
  "phones": ["+14155550123", "+14155550124"],
  "variables": [["Jordan", "#1042"], ["Alex", "#1043"]]
}`,
    responseExample: `{
  "data": { "broadcastId": "clx_broadcast", "sent": 2, "failed": 0 }
}`,
    errors: [
      { code: 400, desc: "Missing templateName/phones, or bad variables" },
      { code: 401, desc: "Missing or invalid Authorization header" },
      { code: 403, desc: "Key is missing the broadcasts:send scope" },
      { code: 404, desc: "Approved template not found" },
      { code: 409, desc: "WhatsApp is not connected" },
    ],
    curl: `curl -X POST "${BASE_URL}/api/v1/broadcasts" \\
  -H "Authorization: Bearer $WACRM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"templateName":"order_update","phones":["+14155550123","+14155550124"],"variables":[["Jordan","#1042"],["Alex","#1043"]]}'`,
    node: `const res = await fetch(\`${BASE_URL}/api/v1/broadcasts\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.WACRM_API_KEY}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    templateName: "order_update",
    phones: ["+14155550123", "+14155550124"],
    variables: [["Jordan", "#1042"], ["Alex", "#1043"]]
  })
})
const json = await res.json()`,
    python: `import requests

res = requests.post(
    f"{BASE_URL}/api/v1/broadcasts",
    json={
        "templateName": "order_update",
        "phones": ["+14155550123", "+14155550124"],
        "variables": [["Jordan", "#1042"], ["Alex", "#1043"]],
    },
    headers={"Authorization": f"Bearer {API_KEY}"},
)
print(res.json())`,
  },
]

export default function ApiDocsPage() {
  const [tab, setTab] = useState<"curl" | "node" | "python">("curl")

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Developer guide</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight">
            API Documentation
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-soft)]">
            Everything you need to integrate the FueledInbox REST API v1 — scopes,
            endpoints, parameters, errors, rate limits, and code samples for
            every request.
          </p>
        </div>
        <a
          href="/wacrm-api.postman_collection.json"
          download="wacrm-api.postman_collection.json"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          style={{
            background: "var(--jade)",
            boxShadow: "0 8px 18px rgba(31, 111, 92, 0.16)",
          }}
        >
          <ArrowDownToLine size={16} /> Download Postman Collection
        </a>
      </div>

      {/* Quick nav */}
      <nav
        className="flex flex-wrap items-center gap-2 rounded-2xl border p-2"
        style={{ borderColor: "var(--line)", background: "var(--paper-raised)" }}
        aria-label="API sections"
      >
        {[
          ["#overview", "Overview"],
          ["#authentication", "Authentication"],
          ["#scopes", "Scopes"],
          ["#endpoints", "Endpoints"],
          ["#errors", "Error codes"],
          ["#rate-limits", "Rate limits"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--paper)]"
            style={{ color: "var(--ink-soft)" }}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Overview + base URL */}
      <Section id="overview" icon={<Info size={18} />} title="Overview" eyebrow="Getting started">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          The FueledInbox API lets you read and write your workspace programmatically.
          Every response is JSON. All endpoints are scoped by your API key, so
          you only ever see data belonging to your account.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <KeyValue label="Base URL" value={BASE_URL} />
          <KeyValue label="Format" value="JSON over HTTPS only" />
          <KeyValue label="Versioning" value="URL-prefixed (/api/v1)" />
          <KeyValue label="Auth" value="Bearer token per request" />
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--ink-soft)]">
          Use{" "}
          <a href="/settings/api-keys" className="font-semibold underline">
            Settings → API Keys
          </a>{" "}
          to create a key and pick its scopes. Store keys on your server — never
          expose them in browser or client code.
        </p>
      </Section>

      {/* Authentication */}
      <Section id="authentication" icon={<KeyRound size={18} />} title="Authentication" eyebrow="Required on every request">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          Send your API key in the{" "}
          <code className="font-[family-name:var(--font-code)]">Authorization</code>{" "}
          header as a Bearer token. All API keys look like{" "}
          <code className="font-[family-name:var(--font-code)]">wacrm_live_…</code>.
        </p>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <SectionLabel>Request headers</SectionLabel>
            <CopyBlock text={`Authorization: Bearer wacrm_live_your_api_key
Content-Type: application/json   # POST/PUT bodies only
Accept: application/json`} />
          </div>
          <div className="rounded-xl px-4 py-3 text-xs leading-5" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
            A missing or invalid key returns{" "}
            <code className="font-[family-name:var(--font-code)]">401</code>. A valid key that
            lacks the required scope returns{" "}
            <code className="font-[family-name:var(--font-code)]">403</code> with the missing
            scope named in the error.
          </div>
        </div>
      </Section>

      {/* Scopes */}
      <Section id="scopes" icon={<ShieldCheck size={18} />} title="Scopes" eyebrow="Least-privilege keys">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          Create keys with only the scopes your integration needs. A key&apos;s
          scopes are returned by{" "}
          <code className="font-[family-name:var(--font-code)]">GET /api/v1/me</code>.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ background: "var(--paper)" }}>
                <Th>Scope</Th>
                <Th>What it grants</Th>
              </tr>
            </thead>
            <tbody>
              {SCOPES.map((s) => (
                <tr key={s.scope} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-3">
                    <code className="font-[family-name:var(--font-code)] text-xs">{s.scope}</code>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--ink-soft)]">{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Endpoints */}
      <Section id="endpoints" icon={<ListOrdered size={18} />} title="Endpoints" eyebrow="Full reference">
        <div className="space-y-6">
          {ENDPOINTS.map((ep) => (
            <EndpointCard key={ep.id} ep={ep} tab={tab} setTab={setTab} />
          ))}
        </div>
      </Section>

      {/* Errors */}
      <Section id="errors" icon={<TriangleAlert size={18} />} title="Error codes" eyebrow="Standard responses">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          Errors use a stable{" "}
          <code className="font-[family-name:var(--font-code)]">{`{ "error": "..." }`}</code>{" "}
          shape with the appropriate HTTP status code.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ background: "var(--paper)" }}>
                <Th>Code</Th>
                <Th>Meaning</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ["400", "Bad request — missing or invalid parameters"],
                ["401", "Missing, invalid, revoked, or expired API key"],
                ["403", "Key is missing the required scope"],
                ["404", "Resource or approved template not found"],
                ["409", "Conflict — e.g. 24-hour window closed or WhatsApp not connected"],
                ["410", "Resource expired"],
                ["429", "Too many requests (rate limited)"],
                ["500", "Unexpected internal error"],
                ["502", "Upstream WhatsApp delivery failed"],
              ].map(([code, desc]) => (
                <tr key={code} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-3">
                    <StatusCode code={code} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--ink-soft)]">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Rate limits */}
      <Section id="rate-limits" icon={<Server size={18} />} title="Rate limits" eyebrow="Fair use">
        <div className="space-y-3 text-sm leading-6 text-[var(--ink-soft)]">
          <p>
            Each account is subject to a rate limit. When you exceed it, the API
            returns{" "}
            <code className="font-[family-name:var(--font-code)]">429</code>.
            Respect the limits and retry with backoff on 429 responses.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <KeyValue label="List / read endpoints" value="100 req / min" />
            <KeyValue label="Send endpoints" value="10 req / min" />
            <KeyValue label="Broadcasts" value="1,000 recipients / broadcast" />
          </div>
          <p className="text-xs leading-5">
            WhatsApp itself enforces additional message throughput limits per
            business phone number. The broadcast endpoint paces sends at ~4 per
            second to stay safe.
          </p>
        </div>
      </Section>

      {/* SDK / code samples */}
      <Section id="sdk" icon={<Code2 size={18} />} title="SDKs & code samples" eyebrow="Any language">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          No official SDK is required — the API is plain HTTPS + JSON. Use any
          HTTP client. Each endpoint above shows a ready-to-use example in{" "}
          <strong>curl</strong>, <strong>Node.js</strong> (fetch), and{" "}
          <strong>Python</strong> (requests). To change the language shown on the
          cards, use the toggle below.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TabButton active={tab === "curl"} onClick={() => setTab("curl")} icon={<Terminal size={14} />}>
            curl
          </TabButton>
          <TabButton active={tab === "node"} onClick={() => setTab("node")} icon={<Code2 size={14} />}>
            Node.js
          </TabButton>
          <TabButton active={tab === "python"} onClick={() => setTab("python")} icon={<FileJson size={14} />}>
            Python
          </TabButton>
        </div>
      </Section>

      {/* Postman */}
      <Section icon={<Download size={18} />} title="Postman collection" eyebrow="Test in one click">
        <div className="flex flex-col gap-3 text-sm leading-6 text-[var(--ink-soft)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Download the ready-made collection below, import it into Postman,
            set the{" "}
            <code className="font-[family-name:var(--font-code)]">baseUrl</code>{" "}
            and{" "}
            <code className="font-[family-name:var(--font-code)]">apiKey</code>{" "}
            collection variables, and start calling every endpoint.
          </p>
          <a
            href="/wacrm-api.postman_collection.json"
            download="wacrm-api.postman_collection.json"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5"
            style={{ borderColor: "var(--line)", background: "var(--paper-raised)", color: "var(--ink)" }}
          >
            <ArrowDownToLine size={16} /> wacrm-api.postman_collection.json
          </a>
        </div>
        <div className="mt-4 rounded-xl px-4 py-3 text-xs leading-5" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
          <strong>Tip:</strong> start with{" "}
          <code className="font-[family-name:var(--font-code)]">GET /api/v1/me</code> to confirm
          your key and base URL, then deliberately call a scope-gated endpoint
          with a key missing that scope to confirm you get a clean{" "}
          <code className="font-[family-name:var(--font-code)]">403</code>.
        </div>
      </Section>
    </div>
  )
}

/* ---------- Presentational helpers ---------- */

function Section({
  id,
  icon,
  title,
  eyebrow,
  children,
}: {
  id?: string
  icon: React.ReactNode
  title: string
  eyebrow?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--line)", background: "var(--paper-raised)" }}
    >
      <div className="flex items-start gap-3 border-b p-5" style={{ borderColor: "var(--line)" }}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
          {icon}
        </span>
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-medium" style={{ color: "var(--ink)" }}>
            {title}
          </h2>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
      <p className="text-[10px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">
        <code className="font-[family-name:var(--font-code)]">{value}</code>
      </p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-[10px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
      {children}
    </th>
  )
}

function StatusCode({ code }: { code: string }) {
  const color = code.startsWith("4")
    ? "var(--coral)"
    : code.startsWith("2")
      ? "var(--jade)"
      : "var(--amber)"
  const bg = code.startsWith("4")
    ? "var(--coral-soft)"
    : code.startsWith("2")
      ? "var(--jade-soft)"
      : "var(--amber-soft)"
  return (
    <span className="inline-flex rounded-lg px-2 py-0.5 text-xs font-bold" style={{ background: bg, color }}>
      {code}
    </span>
  )
}

function EndpointCard({
  ep,
  tab,
  setTab,
}: {
  ep: (typeof ENDPOINTS)[number]
  tab: "curl" | "node" | "python"
  setTab: (t: "curl" | "node" | "python") => void
}) {
  return (
    <article className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--line)" }}>
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
        <MethodBadge method={ep.method} />
        <code className="font-[family-name:var(--font-code)] text-sm font-semibold" style={{ color: "var(--ink)" }}>
          {ep.path}
        </code>
        <span className="ml-auto text-[11px] font-medium text-[var(--ink-soft)]">{ep.title}</span>
      </header>
      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">{ep.description}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg px-2 py-1 font-medium" style={{ background: "var(--paper)", color: "var(--ink-soft)" }}>
            Requires: <code className="font-[family-name:var(--font-code)]">{ep.scope === "none" ? "no scope" : ep.scope}</code>
          </span>
          {ep.params.map((p) => (
            <span key={p.name} className="rounded-lg px-2 py-1" style={{ background: "var(--paper)", color: "var(--ink-soft)" }}>
              {p.required ? (
                <strong style={{ color: "var(--coral)" }}>*</strong>
              ) : (
                <span>· </span>
              )}
              <code className="font-[family-name:var(--font-code)]">{p.name}</code>{" "}
              <span className="text-[var(--ink-soft)]">({p.type})</span>
            </span>
          ))}
        </div>

        {ep.params.length > 0 && (
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ background: "var(--paper)" }}>
                  <Th>Parameter</Th>
                  <Th>Type</Th>
                  <Th>Required</Th>
                  <Th>Description</Th>
                </tr>
              </thead>
              <tbody>
                {ep.params.map((p) => (
                  <tr key={p.name} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-4 py-2.5">
                      <code className="font-[family-name:var(--font-code)] text-xs">{p.name}</code>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--ink-soft)]">{p.type}</td>
                    <td className="px-4 py-2.5 text-xs">{p.required ? <span style={{ color: "var(--coral)" }}>Yes</span> : "No"}</td>
                    <td className="px-4 py-2.5 text-xs text-[var(--ink-soft)]">{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <SectionLabel>Request</SectionLabel>
            <CopyBlock text={ep.requestExample ?? ep.curl} />
          </div>
          <div className="space-y-2">
            <SectionLabel>Response</SectionLabel>
            <CopyBlock text={ep.responseExample} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Code sample</SectionLabel>
            <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "var(--paper)" }}>
              <MiniTab active={tab === "curl"} onClick={() => setTab("curl")}>curl</MiniTab>
              <MiniTab active={tab === "node"} onClick={() => setTab("node")}>Node</MiniTab>
              <MiniTab active={tab === "python"} onClick={() => setTab("python")}>Python</MiniTab>
            </div>
          </div>
          <CopyBlock text={tab === "curl" ? ep.curl : tab === "node" ? ep.node : ep.python} />
        </div>

        <div className="space-y-1.5">
          <SectionLabel>Error responses</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {ep.errors.map((e) => (
              <span key={e.code} className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-[11px]" style={{ background: "var(--paper)", color: "var(--ink-soft)" }}>
                <StatusCode code={String(e.code)} />
                {e.desc}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  const color = method === "GET" ? "var(--jade-dark)" : "var(--amber)"
  const bg = method === "GET" ? "var(--jade-soft)" : "var(--amber-soft)"
  return (
    <span className="rounded-lg px-2.5 py-1 font-[family-name:var(--font-code)] text-xs font-bold" style={{ background: bg, color }}>
      {method}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase">{children}</p>
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="group relative">
      <pre
        className="max-h-72 overflow-auto rounded-xl px-4 py-3 font-[family-name:var(--font-code)] text-[11px] leading-5 whitespace-pre-wrap"
        style={{ background: "var(--paper)", color: "var(--ink)" }}
      >
        {text}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition"
        style={{ background: "var(--paper-raised)", color: "var(--ink-soft)" }}
        aria-label="Copy to clipboard"
      >
        {copied ? <Check size={12} style={{ color: "var(--jade)" }} /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
      style={{
        background: active ? "var(--jade)" : "var(--paper-raised)",
        color: active ? "white" : "var(--ink-soft)",
      }}
    >
      {icon}
      {children}
    </button>
  )
}

function MiniTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-[10px] font-semibold transition"
      style={{ background: active ? "var(--paper-raised)" : "transparent", color: active ? "var(--ink)" : "var(--ink-soft)" }}
    >
      {children}
    </button>
  )
}

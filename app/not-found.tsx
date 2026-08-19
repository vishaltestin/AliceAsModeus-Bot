import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p
          className="font-[family-name:var(--font-code)] text-5xl font-medium"
          style={{ color: "var(--jade)" }}
        >
          404
        </p>
        <h1
          className="mt-5 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight"
          style={{ color: "var(--ink)" }}
        >
          This conversation went missing.
        </h1>
        <p
          className="mt-3 text-sm leading-6"
          style={{ color: "var(--ink-soft)" }}
        >
          The page you are looking for does not exist or is no longer available.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          style={{
            background: "var(--jade)",
            boxShadow: "0 8px 18px rgba(31, 111, 92, 0.18)",
          }}
        >
          Return home
        </Link>
      </div>
    </main>
  )
}

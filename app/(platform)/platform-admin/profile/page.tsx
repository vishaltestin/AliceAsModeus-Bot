"use client"

import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  KeyRound,
  RefreshCw,
  UserRound,
} from "lucide-react"
import { useCallback, useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getPlatformAdminProfile,
  updatePlatformAdminProfile,
  changePlatformAdminPassword,
} from "../actions"

export default function AdminProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [profileMsg, setProfileMsg] = useState<{ ok?: string; err?: string }>({})
  const [passwordMsg, setPasswordMsg] = useState<{ ok?: string; err?: string }>({})
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const p = await getPlatformAdminProfile()
        setName(p.name ?? "")
        setEmail(p.email)
      } catch (reason) {
        console.error("[platform] profile load failed", reason)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function saveProfile() {
    setProfileMsg({})
    startTransition(async () => {
      try {
        const result = await updatePlatformAdminProfile(name, email)
        if (result?.error) setProfileMsg({ err: result.error })
        else {
          setProfileMsg({ ok: "Profile updated." })
          await load()
        }
      } catch (reason) {
        console.error("[platform] profile save failed", reason)
        setProfileMsg({ err: "We couldn't save your profile." })
      }
    })
  }

  function changePassword() {
    setPasswordMsg({})
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ err: "New passwords do not match." })
      return
    }
    startTransition(async () => {
      try {
        const result = await changePlatformAdminPassword(currentPassword, newPassword)
        if (result?.error) setPasswordMsg({ err: result.error })
        else {
          setPasswordMsg({ ok: "Password updated. You may need to sign in again." })
          setCurrentPassword("")
          setNewPassword("")
          setConfirmPassword("")
        }
      } catch (reason) {
        console.error("[platform] password change failed", reason)
        setPasswordMsg({ err: "We couldn't change your password." })
      }
    })
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl" style={{ background: "var(--paper-raised)" }} />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="eyebrow">Account security</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight">
          Admin profile
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Manage your platform-admin account details and password.
        </p>
      </div>

      {/* Profile */}
      <section className="rounded-2xl p-6 shadow-sm ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }}>
        <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: "var(--line)" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
            <UserRound size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Profile details</h2>
            <p className="text-xs text-[var(--ink-soft)]">Your display name and sign-in email.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform Admin" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@your-platform.com" />
          </label>
        </div>
        {profileMsg.ok && <Success text={profileMsg.ok} />}
        {profileMsg.err && <ErrorBox text={profileMsg.err} />}
        <div className="mt-5 flex justify-end border-t pt-4" style={{ borderColor: "var(--line)" }}>
          <Button onClick={saveProfile} disabled={isPending}>
            {isPending ? <RefreshCw size={15} className="animate-spin" /> : null} Save profile
          </Button>
        </div>
      </section>

      {/* Password */}
      <section className="rounded-2xl p-6 shadow-sm ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }}>
        <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: "var(--line)" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
            <KeyRound size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Change password</h2>
            <p className="text-xs text-[var(--ink-soft)]">Use a strong, unique password.</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Current password</span>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>New password</span>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Confirm new password</span>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
            </label>
          </div>
        </div>
        {passwordMsg.ok && <Success text={passwordMsg.ok} />}
        {passwordMsg.err && <ErrorBox text={passwordMsg.err} />}
        <div className="mt-5 flex justify-end border-t pt-4" style={{ borderColor: "var(--line)" }}>
          <Button onClick={changePassword} disabled={isPending}>
            {isPending ? <RefreshCw size={15} className="animate-spin" /> : null} Update password
          </Button>
        </div>
      </section>

      <button
        onClick={() => router.push("/platform-admin")}
        className="text-xs font-semibold"
        style={{ color: "var(--jade)" }}
      >
        ← Back to dashboard
      </button>
    </div>
  )
}

function Success({ text }: { text: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-xl px-3.5 py-3 text-sm" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
      <CheckCircle2 size={16} className="shrink-0" /> {text}
    </div>
  )
}
function ErrorBox({ text }: { text: string }) {
  return <div className="mt-4 rounded-xl px-3.5 py-3 text-sm" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>{text}</div>
}

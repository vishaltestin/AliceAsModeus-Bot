"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { PageHeader } from "@/components/ui/page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useEffect, useState, useTransition } from "react"
import { Mail, UserPlus, ShieldCheck, Clock, Users } from "lucide-react"
import {
  getTeamMembers,
  getPendingInvitations,
  createInvitation,
  revokeInvitation,
  updateMemberRole,
  removeMember,
} from "./actions"

const field = {
  background: "var(--paper)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
}

export default function TeamPage() {
  const [members, setMembers] = useState<
    Awaited<ReturnType<typeof getTeamMembers>>
  >([])
  const [invites, setInvites] = useState<
    Awaited<ReturnType<typeof getPendingInvitations>>
  >([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "AGENT" | "VIEWER">(
    "AGENT"
  )
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  async function refresh() {
    try {
      const [nextMembers, nextInvites] = await Promise.all([
        getTeamMembers(),
        getPendingInvitations(),
      ])
      setMembers(nextMembers)
      setInvites(nextInvites)
      setError(null)
    } catch (reason) {
      console.error("[wacrm] Team load failed", reason)
      setError("We couldn't load team settings. Please try again.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(task)
  }, [])

  function handleInvite() {
    setError(null)
    startTransition(async () => {
      try {
        const { token } = await createInvitation(inviteRole)
        setGeneratedLink(`${window.location.origin}/join/${token}`)
        await refresh()
      } catch (reason) {
        console.error("[wacrm] Create invitation failed", reason)
        setError("We couldn't create an invitation. Please try again.")
      }
    })
  }

  if (loading) {
    return (
      <div className="max-w-2xl animate-pulse space-y-3">
        <div
          className="h-9 w-52 rounded-xl"
          style={{ background: "var(--line)" }}
        />
        <div
          className="h-24 rounded-2xl"
          style={{ background: "var(--paper-raised)" }}
        />
        <div
          className="h-24 rounded-2xl"
          style={{ background: "var(--paper-raised)" }}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="People and permissions"
        title="Team members"
        description="Invite teammates and keep workspace access aligned with their role."
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <Users size={16} />
          <span>
            <strong className="font-semibold text-[var(--ink)]">
              {members.length}
            </strong>{" "}
            member{members.length === 1 ? "" : "s"}
          </span>
          {invites.length > 0 && (
            <span className="hidden text-[var(--line)] sm:inline">·</span>
          )}
          {invites.length > 0 && (
            <span className="hidden sm:inline">
              {invites.length} pending invitation{invites.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <Button
          size="lg"
          onClick={() => {
            setInviteOpen(true)
            setGeneratedLink(null)
          }}
        >
          <UserPlus size={15} /> Invite member
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      <Card className="mt-6 mb-8 overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-3.5">
          <Users size={15} style={{ color: "var(--jade)" }} />
          <span className="text-sm font-semibold">Members</span>
          <span className="ml-auto text-xs text-[var(--ink-soft)]">
            {members.length} total
          </span>
        </div>
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 border-b px-5 py-3.5 last:border-b-0"
            style={{
              borderColor: "var(--line)",
              background: "var(--paper-raised)",
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="bg-[var(--jade)] text-xs font-semibold text-white">
                  {initials(m.name || m.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  {m.name || m.email}
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-[var(--ink-soft)]">
                  <Mail size={12} /> {m.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {m.accountRole === "OWNER" ? (
                <Badge variant="warning">
                  <ShieldCheck size={12} /> Owner
                </Badge>
              ) : (
                <>
                  <Select
                    defaultValue={m.accountRole}
                    onValueChange={(nextRole) => {
                      if (!["ADMIN", "AGENT", "VIEWER"].includes(nextRole))
                        return
                      setError(null)
                      startTransition(async () => {
                        try {
                          await updateMemberRole(
                            m.id,
                            nextRole as "ADMIN" | "AGENT" | "VIEWER"
                          )
                          await refresh()
                        } catch (reason) {
                          console.error(
                            "[wacrm] Update team role failed",
                            reason
                          )
                          setError(
                            "We couldn't update this role. Please try again."
                          )
                        }
                      })
                    }}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="AGENT">Agent</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => setConfirmRemoveId(m.id)}
                    className="text-xs"
                    style={{ color: "var(--coral)" }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </Card>

      {invites.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center gap-2 border-b px-5 py-3.5">
            <Clock size={15} style={{ color: "var(--amber)" }} />
            <span className="text-sm font-semibold">Pending invitations</span>
            <Badge variant="warning" className="ml-1">
              {invites.length}
            </Badge>
          </div>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-3 border-b px-5 py-3.5 last:border-b-0"
              style={{
                borderColor: "var(--line)",
                background: "var(--paper-raised)",
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "var(--amber-soft)",
                    color: "var(--amber)",
                  }}
                >
                  <UserPlus size={15} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--ink)]">
                    Invited as <strong>{inv.role}</strong>
                  </p>
                  <p className="text-[11px] text-[var(--ink-soft)]">
                    Link expires after 7 days
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await revokeInvitation(inv.id)
                      await refresh()
                    } catch (reason) {
                      console.error(
                        "[wacrm] Revoke invitation failed",
                        reason
                      )
                      setError(
                        "We couldn't revoke this invitation. Please try again."
                      )
                    }
                  })
                }
                className="shrink-0 text-[var(--coral)]"
              >
                Revoke
              </Button>
            </div>
          ))}
        </Card>
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        eyebrow="People and permissions"
        title={generatedLink ? "Invitation ready" : "Invite a teammate"}
        description={
          generatedLink
            ? "Share this single-use link. It expires in 7 days."
            : "Choose the access level this teammate should start with."
        }
        size="sm"
      >
        {!generatedLink ? (
          <div className="space-y-4">
            <Select
              value={inviteRole}
              onValueChange={(nextRole) => {
                if (["ADMIN", "AGENT", "VIEWER"].includes(nextRole))
                  setInviteRole(nextRole as "ADMIN" | "AGENT" | "VIEWER")
              }}
            >
              <SelectTrigger className="w-full" aria-label="Invitation role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[80]">
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="AGENT">Agent</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <div
              className="flex justify-end gap-2 border-t pt-4"
              style={{ borderColor: "var(--line)" }}
            >
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={isPending}>
                {isPending ? "Generating…" : "Generate invite link"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              readOnly
              value={generatedLink ?? ""}
              onFocus={(e) => e.target.select()}
              className="font-[family-name:var(--font-code)] text-xs"
              aria-label="Generated invitation link"
            />
            <Button className="w-full" onClick={() => setInviteOpen(false)}>
              Done
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmRemoveId !== null}
        onOpenChange={(open) => !open && setConfirmRemoveId(null)}
        onConfirm={() => {
          if (!confirmRemoveId) return
          setError(null)
          startTransition(async () => {
            try {
              await removeMember(confirmRemoveId)
              setConfirmRemoveId(null)
              await refresh()
            } catch (reason) {
              console.error("[wacrm] Remove team member failed", reason)
              setError(
                "We couldn't remove this team member. Please try again."
              )
            }
          })
        }}
        title="Remove this team member?"
        description="They will immediately lose access to this workspace. Their data is not deleted."
        confirmLabel="Remove member"
      />
    </div>
  )
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return value.slice(0, 2).toUpperCase()
}

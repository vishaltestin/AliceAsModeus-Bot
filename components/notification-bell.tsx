"use client"

import { Bell, CheckCheck, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(dashboard)/notifications/actions"
import { formatRelativeTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getNotifications>
  > | null>(null)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    try {
      setData(await getNotifications())
    } catch (error) {
      console.error("[wacrm] Notifications load failed", error)
    }
  }

  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0)
    const interval = window.setInterval(() => void refresh(), 30000)
    return () => {
      window.clearTimeout(task)
      window.clearInterval(interval)
    }
  }, [])

  async function markRead(id: string) {
    setLoading(true)
    try {
      await markNotificationRead(id)
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  async function markAllRead() {
    setLoading(true)
    try {
      await markAllNotificationsRead()
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  const unreadCount = data?.unreadCount ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-xl"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--coral)] px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(380px,calc(100vw-2rem))] p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-[11px] text-[var(--ink-soft)]">
              {unreadCount ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => void markAllRead()}
              className="text-[var(--jade)]"
            >
              <CheckCheck size={13} /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[min(400px,60svh)]">
          <div>
            {data?.items.length ? (
              data.items.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="border-b px-4 py-3 last:border-b-0"
                  style={{
                    background: item.readAt ? "transparent" : "var(--jade-soft)",
                  }}
                >
                  <div className="flex gap-3">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: item.readAt ? "var(--line)" : "var(--jade)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">
                        {item.body}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[var(--ink-soft)]">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        {item.href ? (
                          <Link
                            href={item.href}
                            onClick={() => {
                              void markRead(item.id)
                              setOpen(false)
                            }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-[var(--jade)]"
                          >
                            Open <ExternalLink size={11} />
                          </Link>
                        ) : (
                          !item.readAt && (
                            <button
                              type="button"
                              onClick={() => void markRead(item.id)}
                              className="text-[10px] font-semibold text-[var(--jade)]"
                            >
                              Mark read
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-12 text-center">
                <Bell
                  size={24}
                  className="mx-auto text-[var(--line)]"
                />
                <p className="mt-3 text-xs text-[var(--ink-soft)]">
                  No notifications yet.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
        <Separator />
        <div className="px-4 py-2.5 text-center text-[10px] text-[var(--ink-soft)]">
          Refreshes automatically
        </div>
      </PopoverContent>
    </Popover>
  )
}

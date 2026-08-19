"use client"

import {
  BookOpen,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  FileText,
  Inbox,
  LayoutDashboard,
  KanbanSquare,
  Key,
  LogOut,
  Megaphone,
  Moon,
  Phone,
  Sun,
  Tag,
  UserRound,
  Users,
  Zap,
} from "lucide-react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { isAdminRole, roleLabel } from "@/lib/permissions"
import { RoleProvider } from "@/components/role-context"
import { NotificationBell } from "@/components/notification-bell"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

const navigation = [
  {
    title: "Workspace",
    links: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Inbox", href: "/inbox", icon: Inbox },
      { name: "Pipelines", href: "/pipelines", icon: KanbanSquare },
      { name: "Contacts", href: "/contacts", icon: Users },
      { name: "Broadcasts", href: "/broadcasts", icon: Megaphone },
      { name: "Automations", href: "/automations", icon: Zap },
    ],
  },
  {
    title: "Settings",
    links: [
      { name: "Team", href: "/settings/team", icon: Users },
      { name: "API Keys", href: "/settings/api-keys", icon: Key },
      { name: "API Docs", href: "/settings/api-docs", icon: BookOpen },
      { name: "Fields & Tags", href: "/settings/fields-tags", icon: Tag },
      { name: "Templates", href: "/settings/templates", icon: FileText },
      { name: "WhatsApp Setup", href: "/settings/whatsapp", icon: Phone },
      { name: "Audit Log", href: "/settings/audit-logs", icon: ClipboardList },
    ],
  },
]

type DashboardUser = {
  name: string | null | undefined
  email: string | null | undefined
  accountRole: string
}

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: DashboardUser
}) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const displayName =
    user.name?.trim() || user.email?.split("@")[0] || "Teammate"
  const initials = useMemo(() => getInitials(displayName), [displayName])
  const isInbox = pathname === "/inbox" || pathname.startsWith("/inbox/")
  const isAutomationCanvas =
    pathname === "/automations/new" ||
    /\/(automations)\/[^/]+\/edit$/.test(pathname)
  const isPipeline = pathname === "/pipelines" || pathname.startsWith("/pipelines/")
  // Canvas pages hide the top header (inbox & automation builder take over the screen).
  const isCanvas = isInbox || isAutomationCanvas
  // Full-bleed pages fill the viewport without the page scrolling, but keep the
  // top header for nav + notifications.
  const isFullBleed = isCanvas || isPipeline
  const canManageSettings = isAdminRole(user.accountRole)

  async function handleSignOut() {
    setSignOutError(null)
    setIsSigningOut(true)
    try {
      await signOut({ redirectTo: "/login" })
    } catch (error) {
      console.error("[wacrm] Sign out failed", error)
      setSignOutError("We couldn't sign you out. Please try again.")
      setIsSigningOut(false)
    }
  }

  return (
    <SidebarProvider>
      <DashboardChrome
        user={user}
        displayName={displayName}
        initials={initials}
        canManageSettings={canManageSettings}
        isCanvas={isCanvas}
        isFullBleed={isFullBleed}
        isSigningOut={isSigningOut}
        signOutError={signOutError}
        handleSignOut={handleSignOut}
        resolvedTheme={resolvedTheme}
        setTheme={setTheme}
      >
        {children}
      </DashboardChrome>
    </SidebarProvider>
  )
}

function DashboardChrome({
  children,
  user,
  displayName,
  initials,
  canManageSettings,
  isCanvas,
  isFullBleed,
  isSigningOut,
  signOutError,
  handleSignOut,
  resolvedTheme,
  setTheme,
}: {
  children: React.ReactNode
  user: DashboardUser
  displayName: string
  initials: string
  canManageSettings: boolean
  isCanvas: boolean
  isFullBleed: boolean
  isSigningOut: boolean
  signOutError: string | null
  handleSignOut: () => void
  resolvedTheme: string | undefined
  setTheme: (theme: string) => void
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="border-b px-4 py-4">
          <Link
            href="/inbox"
            onClick={() => setOpenMobile(false)}
            className="flex flex-col items-start gap-1"
            aria-label="FueledInbox inbox"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/fueledinbox-logo.png"
              alt="FueledInbox"
              className="h-9 w-auto shrink-0"
              style={{ objectFit: "contain" }}
            />
            <span className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-tight">
              FueledInbox
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          {navigation.map((section) => {
            if (section.title === "Settings" && !canManageSettings) return null
            return (
              <SidebarGroup key={section.title}>
                <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.links.map((link) => {
                      const isActive =
                        pathname === link.href ||
                        pathname.startsWith(`${link.href}/`)
                      const Icon = link.icon
                      return (
                        <SidebarMenuItem key={link.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className="group/menu-button"
                          >
                            <Link href={link.href} onClick={() => setOpenMobile(false)}>
                              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                              <span>{link.name}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )
          })}
        </SidebarContent>

        <SidebarFooter className="border-t p-3">
          <div
            className="mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-[var(--ink-soft)]"
            style={{ background: "var(--paper)" }}
          >
            <CircleHelp size={15} />
            <span>Need help?</span>
            <span className="ml-auto text-[10px] text-[var(--jade)]">
              Soon
            </span>
          </div>
          <ProfileMenu
            user={user}
            displayName={displayName}
            initials={initials}
            resolvedTheme={resolvedTheme}
            setTheme={setTheme}
            isSigningOut={isSigningOut}
            signOutError={signOutError}
            handleSignOut={handleSignOut}
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-[var(--paper)]">
        <RoleProvider role={user.accountRole}>
        <header
          className={`sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b px-3 sm:h-16 sm:px-6 ${
            isCanvas ? "lg:hidden" : ""
          }`}
          style={{
            borderColor: "var(--line)",
            background: "var(--paper-raised)",
          }}
        >
          <SidebarTrigger className="-ml-1" />
          <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
            FueledInbox
          </p>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        <div
          className={
            isFullBleed
              ? "min-h-0 flex-1 overflow-hidden"
              : "min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
          }
        >
          <div className={isFullBleed ? "h-full" : "mx-auto w-full max-w-[1480px]"}>
            {children}
          </div>
        </div>
        </RoleProvider>
      </SidebarInset>
    </>
  )
}

function ProfileMenu({
  user,
  displayName,
  initials,
  resolvedTheme,
  setTheme,
  isSigningOut,
  signOutError,
  handleSignOut,
}: {
  user: DashboardUser
  displayName: string
  initials: string
  resolvedTheme: string | undefined
  setTheme: (theme: string) => void
  isSigningOut: boolean
  signOutError: string | null
  handleSignOut: () => void
}) {
  const { setOpenMobile } = useSidebar()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-3 rounded-xl px-2.5 py-2 text-left"
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-[var(--jade)] text-xs font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-semibold">
              {displayName}
            </span>
            <span className="truncate text-[11px] text-[var(--ink-soft)] capitalize">
              {roleLabel(user.accountRole)}
            </span>
          </span>
          <ChevronsUpDown
            size={15}
            className="shrink-0 text-[var(--ink-soft)]"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        collisionPadding={16}
        className="z-[80] w-[min(16rem,calc(100vw-1.5rem))]"
      >
        <DropdownMenuLabel>
          <span className="block truncate text-xs font-semibold">
            {user.email}
          </span>
          <Badge variant="secondary" className="mt-1">
            {roleLabel(user.accountRole)}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {signOutError && (
          <div className="px-2 py-2 text-[11px] text-[var(--coral)]">
            {signOutError}
          </div>
        )}
        <DropdownMenuItem asChild>
          <Link href="/profile" onClick={() => setOpenMobile(false)}>
            <UserRound size={15} /> Profile &amp; security
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? (
            <Sun size={15} />
          ) : (
            <Moon size={15} />
          )}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onClick={handleSignOut}
        >
          <LogOut size={15} />
          {isSigningOut ? "Signing out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getInitials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return value.slice(0, 2).toUpperCase()
}

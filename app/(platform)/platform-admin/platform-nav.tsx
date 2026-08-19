"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  BarChart3,
  Building2,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  UserRound,
} from "lucide-react"
import { useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const NAV = [
  {
    section: "Console",
    links: [
      { href: "/platform-admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/platform-admin/accounts", label: "Accounts", icon: Building2 },
      { href: "/platform-admin/ledger", label: "Ledger", icon: ReceiptText },
    ],
  },
  {
    section: "Account",
    links: [
      { href: "/platform-admin/profile", label: "Profile", icon: UserRound },
    ],
  },
]

export function PlatformSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut({ redirectTo: "/admin/login" })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4" style={{ borderColor: "var(--line)" }}>
        <div className="flex flex-col items-start gap-1 group-data-[collapsible=icon]:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fueledinbox-logo.png"
            alt="FueledInbox"
            className="h-8 w-auto shrink-0"
            style={{ objectFit: "contain" }}
          />
          <span className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight">
            FueledInbox
          </span>
        </div>
        <span
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl font-[family-name:var(--font-display)] text-base font-bold text-white group-data-[collapsible=icon]:flex"
          style={{
            background:
              "linear-gradient(150deg, var(--brand-navy), var(--brand-blue))",
          }}
        >
          F
        </span>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {NAV.map((group) => (
          <SidebarGroup key={group.section}>
            <SidebarGroupLabel>{group.section}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.links.map((link) => {
                  const active =
                    pathname === link.href ||
                    pathname.startsWith(`${link.href}/`)
                  const Icon = link.icon
                  return (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className="group/menu-button"
                      >
                        <Link href={link.href}>
                          <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                          <span>{link.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-3" style={{ borderColor: "var(--line)" }}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => router.push("/inbox")}>
              <BarChart3 size={17} />
              <span>Back to app</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="text-[var(--coral)]"
            >
              <LogOut size={17} />
              <span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

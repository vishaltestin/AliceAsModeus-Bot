"use client"

import { createContext, useContext } from "react"
import { isAdminRole, canWriteWorkspace } from "@/lib/permissions"

export type RoleInfo = {
  role: string
  isAdmin: boolean
  canWrite: boolean
  canView: boolean // every authenticated member can view the workspace
}

const RoleContext = createContext<RoleInfo>({
  role: "AGENT",
  isAdmin: false,
  canWrite: true,
  canView: true,
})

export function RoleProvider({
  role,
  children,
}: {
  role: string | null | undefined
  children: React.ReactNode
}) {
  const value: RoleInfo = {
    role: role ?? "AGENT",
    isAdmin: isAdminRole(role),
    canWrite: canWriteWorkspace(role),
    canView: true,
  }
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleInfo {
  return useContext(RoleContext)
}

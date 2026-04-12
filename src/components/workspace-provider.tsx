'use client'

import { createContext, useContext } from 'react'
import { WorkspaceMember, Workspace } from '@/types'

interface WorkspaceMemberWithWorkspace extends WorkspaceMember {
  workspace: Workspace
}

interface WorkspaceContextValue {
  membership: WorkspaceMemberWithWorkspace
  workspace: Workspace
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({
  membership,
  children,
}: {
  membership: WorkspaceMemberWithWorkspace
  children: React.ReactNode
}) {
  return (
    <WorkspaceContext.Provider value={{ membership, workspace: membership.workspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be inside WorkspaceProvider')
  return ctx
}

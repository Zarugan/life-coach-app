import React from 'react'

interface LayoutSidebarProps {
  className?: string
  children: React.ReactNode
}

export function LayoutSidebar({ className, children }: LayoutSidebarProps) {
  return (
    <aside className={className}>
      {children}
    </aside>
  )
}

interface LayoutHeaderProps {
  className?: string
  children: React.ReactNode
}

export function LayoutHeader({ className, children }: LayoutHeaderProps) {
  return (
    <header className={className}>
      {children}
    </header>
  )
}

interface LayoutContentProps {
  className?: string
  children: React.ReactNode
}

export function LayoutContent({ className, children }: LayoutContentProps) {
  return (
    <main className={className}>
      {children}
    </main>
  )
}

interface LayoutDashboardProps {
  className?: string
  children: React.ReactNode
}

export function LayoutDashboard({ className, children }: LayoutDashboardProps) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}
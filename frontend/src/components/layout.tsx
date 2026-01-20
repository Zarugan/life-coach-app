import React, { useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { 
  LayoutDashboard,
  LayoutSidebar, 
  LayoutHeader,
  LayoutContent 
} from '@/components/ui'
import { useAuth } from '@/contexts/auth-context'
import {
  HomeIcon,
  ChartBarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CameraIcon,
  CogIcon,
  MenuIcon,
  XMarkIcon,
  ChevronDownIcon,
  TrophyIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
      current: true
    },
    {
      name: 'Agents',
      href: '/agents',
      icon: UserGroupIcon,
      current: false
    },
    {
      name: 'Receipts',
      href: '/receipts',
      icon: CameraIcon,
      current: false
    },
    {
      name: 'Goals',
      href: '/goals',
      icon: DocumentTextIcon,
      current: false
    },
    {
      name: 'Progress',
      href: '/progress',
      icon: ChartBarIcon,
      current: false
    },
    {
      name: 'Rewards',
      href: '/rewards',
      icon: TrophyIcon,
      current: false
    },
  ]

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-black/50"></div>
        </div>
      )}

      {/* Sidebar */}
      <LayoutSidebar className={clsx(
        'sidebar',
        sidebarOpen ? 'sidebar-open' : 'sidebar-closed lg:translate-x-0'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">LC</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-neutral-900">Life Coach</h1>
                <p className="text-xs text-neutral-500">AI Coaching Team</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md hover:bg-neutral-100"
            >
              <XMarkIcon className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
                  item.current 
                    ? 'bg-primary-100 text-primary-700 border-l-4 border-primary-600' 
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* User section */}
          <div className="border-t border-neutral-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="p-2 rounded-md hover:bg-neutral-100"
                >
                  <ChevronDownIcon className="w-4 h-4 text-neutral-500" />
                </button>
                
                {/* User dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 z-50">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          // Navigate to profile
                          setUserMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 flex items-center space-x-2"
                      >
                        <UserGroupIcon className="w-4 h-4" />
                        <span>Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          logout()
                          setUserMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 flex items-center space-x-2"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </LayoutSidebar>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <LayoutHeader>
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-md hover:bg-neutral-100"
          >
            <MenuIcon className="w-5 h-5 text-neutral-500" />
          </button>

          {/* Header content */}
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">
                Welcome back, {user?.name || 'User'}!
              </h2>
              <p className="text-sm text-neutral-500">
                Here's your life coaching overview
              </p>
            </div>
            
            {/* Quick actions */}
            <div className="flex items-center space-x-3">
              <button className="btn btn-primary btn-sm">
                <CameraIcon className="w-4 h-4 mr-2" />
                Scan Receipt
              </button>
              <button className="btn btn-outline btn-sm">
                <DocumentTextIcon className="w-4 h-4 mr-2" />
                Quick Log
              </button>
            </div>
          </div>

          {/* Settings */}
          <Link
            to="/profile"
            className="p-2 rounded-md hover:bg-neutral-100"
          >
            <CogIcon className="w-5 h-5 text-neutral-500" />
          </Link>
        </LayoutHeader>

        {/* Page content */}
        <LayoutContent>
          <Outlet />
        </LayoutContent>
      </div>
    </div>
  )
}
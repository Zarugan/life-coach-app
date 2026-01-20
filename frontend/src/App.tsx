import React from 'react'
import { Routes, Route, Navigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import { Layout } from '@/components/layout'
import { ProtectedRoute } from '@/components/protected-route'

// Lazy load components for code splitting
const Dashboard = React.lazy(() => import('@/pages/dashboard'))
const Agents = React.lazy(() => import('@/pages/agents'))
const Receipts = React.lazy(() => import('@/pages/receipts'))
const Goals = React.lazy(() => import('@/pages/goals'))
const Progress = React.lazy(() => import('@/pages/progress'))
const Rewards = React.lazy(() => import('@/pages/rewards'))
const Profile = React.lazy(() => import('@/pages/profile'))
const Login = React.lazy(() => import('@/pages/login'))
const Register = React.lazy(() => import('@/pages/register'))

export function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <Login />
          } 
        />
        <Route 
          path="/register" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <Register />
          } 
        />
        
        {/* Protected routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/agents" 
          element={
            <ProtectedRoute>
              <Layout>
                <Agents />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/receipts" 
          element={
            <ProtectedRoute>
              <Layout>
                <Receipts />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/goals" 
          element={
            <ProtectedRoute>
              <Layout>
                <Goals />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/progress" 
          element={
            <ProtectedRoute>
              <Layout>
                <Progress />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/rewards" 
          element={
            <ProtectedRoute>
              <Layout>
                <Rewards />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        {/* Default route */}
        <Route 
          path="/" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
          } 
        />
        
        {/* Catch all route */}
        <Route 
          path="*" 
          element={
            <Navigate to="/dashboard" replace />
          } 
        />
      </Routes>
    </div>
  )
}
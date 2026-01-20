import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { 
  HomeIcon, 
  TrendingUpIcon, 
  UserGroupIcon,
  DollarSignIcon,
  CameraIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline'
import { Card, CardHeader, CardBody, Progress, Badge } from '@/components/ui'
import { formatCurrency, timeAgo } from '@/utils'

export default function Dashboard() {
  const { data: user, isLoading } = useQuery('user', () =>
    fetch('/api/user').then(res => res.json())
  )

  const { data: stats } = useQuery('stats', () =>
    fetch('/api/stats').then(res => res.json())
  )

  const { data: recentActivity } = useQuery('recentActivity', () =>
    fetch('/api/activity/recent').then(res => res.json())
  )

  const { data: goals } = useQuery('goals', () =>
    fetch('/api/goals?status=active').then(res => res.json())
  )

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user?.name || 'User'}! 👋
        </h1>
        <p className="text-primary-100">
          Here's what your AI coaching team has been working on
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Active Goals</h3>
              <UserGroupIcon className="w-5 h-5 text-primary-600" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold text-primary-600">
              {stats?.activeGoals || 0}
            </div>
            <p className="text-sm text-neutral-500">goals in progress</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Weekly Progress</h3>
              <ArrowTrendingUpIcon className="w-5 h-5 text-success-600" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold text-success-600">
              {stats?.weeklyProgress || 0}%
            </div>
            <p className="text-sm text-neutral-500">improvement</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Receipts Scanned</h3>
              <CameraIcon className="w-5 h-5 text-primary-600" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold text-primary-600">
              {stats?.receiptsScanned || 0}
            </div>
            <p className="text-sm text-neutral-500">this month</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Money Saved</h3>
              <DollarSignIcon className="w-5 h-5 text-success-600" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold text-success-600">
              {formatCurrency(stats?.moneySaved || 0)}
            </div>
            <p className="text-sm text-neutral-500">this month</p>
          </CardBody>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover-lift">
          <CardBody className="text-center">
            <CameraIcon className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Scan Receipt</h3>
            <p className="text-sm text-neutral-500 mb-4">Quick expense tracking with AI analysis</p>
            <Link to="/receipts" className="btn btn-primary w-full">
              Upload Receipt
            </Link>
          </CardBody>
        </Card>

        <Card className="hover-lift">
          <CardBody className="text-center">
            <DocumentTextIcon className="w-12 h-12 text-secondary-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Log Activity</h3>
            <p className="text-sm text-neutral-500 mb-4">Quick progress logging</p>
            <button className="btn btn-secondary w-full">
              Log Progress
            </button>
          </CardBody>
        </Card>
      </div>

      {/* Active Goals */}
      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">Active Goals</h3>
          <Link to="/goals" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            View All →
          </Link>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {goals?.slice(0, 3).map((goal) => (
              <div key={goal.id} className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                  <div className="flex-1">
                    <h4 className="font-medium text-neutral-900">{goal.title}</h4>
                    <p className="text-sm text-neutral-500">{goal.category}</p>
                  </div>
                  <div className="text-right">
                    <Progress value={goal.currentValue || 0} max={goal.targetValue || 100} showLabel={false} />
                    <p className="text-sm text-neutral-500 mt-2">
                      {Math.round(((goal.currentValue || 0) / (goal.targetValue || 100)) * 100)}%
                    </p>
                  </div>
              </div>
            ))}
            {goals?.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                <DocumentTextIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <p>No active goals yet</p>
                <Link to="/goals" className="btn btn-primary mt-4">
                  Create Your First Goal
                </Link>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">Recent Activity</h3>
          <Link to="/progress" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            View All →
          </Link>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {recentActivity?.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
                  <div className="flex-shrink-0">
                    <Badge variant={activity.type === 'achievement' ? 'success' : 'neutral'}>
                      {activity.type === 'achievement' && '🎉'}
                      {activity.type === 'milestone' && '⭐'}
                      {activity.type === 'setback' && '⚠️'}
                      {activity.type === 'insight' && '💡'}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-neutral-900">{activity.title}</h4>
                    <p className="text-sm text-neutral-500 mt-1">{activity.description}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {timeAgo(activity.timestamp)}
                    </p>
                  </div>
              </div>
            ))}
            {recentActivity?.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                <ChartBarIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Agent Status */}
      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">AI Coaching Team</h3>
          <Link to="/agents" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            Manage Agents →
          </Link>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Financial Advisor */}
            <div className="text-center p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl">💰</span>
              </div>
              <h4 className="font-medium text-neutral-900">Financial Advisor</h4>
              <p className="text-sm text-neutral-500">Active</p>
            </div>

            {/* Dietitian */}
            <div className="text-center p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl">🥗</span>
              </div>
              <h4 className="font-medium text-neutral-900">Dietitian</h4>
              <p className="text-sm text-neutral-500">Active</p>
            </div>

            {/* Fitness Trainer */}
            <div className="text-center p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50">
              <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl">💪</span>
              </div>
              <h4 className="font-medium text-neutral-900">Fitness Trainer</h4>
              <p className="text-sm text-neutral-500">Active</p>
            </div>

            {/* Chore Manager */}
            <div className="text-center p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50">
              <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl">🏠</span>
              </div>
              <h4 className="font-medium text-neutral-900">Chore Manager</h4>
              <p className="text-sm text-neutral-500">Active</p>
            </div>

            {/* Digital Wellness */}
            <div className="text-center p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl">🧘</span>
              </div>
              <h4 className="font-medium text-neutral-900">Digital Wellness</h4>
              <p className="text-sm text-neutral-500">Active</p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { 
  UserGroupIcon, 
  PlusIcon,
  ClockIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  PauseIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline'
import { Card, CardHeader, CardBody, Progress, Button, Badge } from '@/components/ui'
import { formatCurrency, formatDateTime, timeAgo } from '@/utils'

interface Goal {
  id: string
  title: string
  description: string
  category: string
  targetValue?: number
  currentValue?: number
  unit?: string
  deadline?: string
  priority: 'low' | 'medium' | 'high'
  status: 'active' | 'completed' | 'paused' | 'cancelled'
  agentIds: string[]
  createdAt: string
  updatedAt: string
}

export default function Goals() {
  const { data: goals, isLoading } = useQuery(
    'goals',
    () => fetch('/api/goals').then(res => res.json())
  )

  const { data: stats } = useQuery(
    'goals-stats',
    () => fetch('/api/goals/stats').then(res => res.json())
  )

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      financial: <span className="text-xl">💰</span>,
      health: <span className="text-xl">❤️</span>,
      fitness: <span className="text-xl">💪</span>,
      nutrition: <span className="text-xl">🥗</span>,
      chores: <span className="text-xl">🏠</span>,
      wellness: <span className="text-xl">🧘</span>,
      career: <span className="text-xl">📈</span>,
      relationships: <span className="text-xl">💑</span>,
      personal: <span className="text-xl">✨</span>
    }
    return icons[category] || <UserGroupIcon className="w-5 h-5 text-neutral-500" />
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'success',
      completed: 'primary',
      paused: 'warning',
      cancelled: 'neutral'
    }
    return colors[status] || 'neutral'
  }

  const getPriorityColor = (priority: string) => {
    const colors: {
      high: 'danger',
      medium: 'warning',
      low: 'info'
    }
    return colors[priority] || 'neutral'
  }

  const getProgressPercentage = (currentValue?: number, targetValue?: number): number => {
    if (!currentValue || !targetValue) return 0
    return Math.round((currentValue / targetValue) * 100)
  }

  const activeGoals = goals?.filter(goal => goal.status === 'active') || []
  const completedGoals = goals?.filter(goal => goal.status === 'completed') || []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Goals</h1>
          <p className="text-neutral-500 mt-1">Track your progress and achieve your dreams</p>
        </div>
        <Button className="btn btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          Create Goal
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-primary-600">{stats?.totalGoals || 0}</div>
            <p className="text-sm text-neutral-500">Total Goals</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-success-600">{stats?.activeGoals || 0}</div>
              <p className="text-sm text-neutral-500">Active</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-primary-600">{stats?.completedGoals || 0}</div>
              <p className="text-sm text-neutral-500">Completed</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-warning-600">{stats?.completionRate || 0}%</div>
              <p className="text-sm text-neutral-500">Success Rate</p>
          </CardBody>
        </Card>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button className="btn btn-outline btn-sm">All Goals</Button>
        <Button className="btn btn-outline btn-sm">Active</Button>
        <Button className="btn btn-outline btn-sm">Completed</Button>
        <Button className="btn btn-outline btn-sm">This Month</Button>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-neutral-500">Sort by:</span>
          <select className="text-sm border border-neutral-300 rounded-md px-3 py-1">
            <option>Created Date</option>
            <option>Priority</option>
            <option>Deadline</option>
          </select>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeGoals.map((goal) => (
          <Card key={goal.id} className="hover-lift">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {getCategoryIcon(goal.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-neutral-900 truncate">{goal.title}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant={getPriorityColor(goal.priority)}>
                        {goal.priority}
                      </Badge>
                      <Badge variant={getStatusColor(goal.status)}>
                        {goal.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-500">{goal.category}</p>
                </div>
              </div>
                <div className="flex items-center space-x-2">
                  {goal.deadline && (
                    <div className="text-right">
                      <div className="flex items-center text-sm text-neutral-500">
                        <ClockIcon className="w-4 h-4 mr-1" />
                        {formatDateTime(goal.deadline)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardBody>
              <p className="text-sm text-neutral-600 mb-4 line-clamp-2">
                {goal.description}
              </p>
              
              {goal.targetValue && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-neutral-700">Progress</span>
                    <span className="text-sm text-neutral-500">
                      {goal.currentValue} / {goal.targetValue} {goal.unit || ''}
                    </span>
                  </div>
                  <Progress 
                    value={getProgressPercentage(goal.currentValue, goal.targetValue)} 
                    max={goal.targetValue} 
                  />
                  <div className="text-right mt-2">
                    <span className="text-sm font-medium text-neutral-700">
                      {getProgressPercentage(goal.currentValue, goal.targetValue)}%
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-3">
                <Link 
                  to={`/goals/${goal.id}`}
                  className="btn btn-primary btn-sm flex-1"
                >
                  View Details
                </Link>
                <Link 
                  to={`/goals/${goal.id}/edit`}
                  className="btn btn-outline btn-sm"
                >
                  Edit
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}

        {activeGoals.length === 0 && (
          <div className="col-span-full text-center py-12">
            <UserGroupIcon className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">No active goals</h3>
            <p className="text-neutral-500 mb-6">Start your journey by creating your first goal</p>
            <Link to="/goals/create" className="btn btn-primary">
              Create Your First Goal
            </Link>
          </div>
        )}
      </div>

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">Completed Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedGoals.slice(0, 6).map((goal) => (
              <Card key={goal.id} className="hover-lift">
                <CardBody className="text-center">
                  <CheckCircleIcon className="w-12 h-12 text-success-600 mx-auto mb-3" />
                  <h4 className="font-semibold text-neutral-900 mb-2">{goal.title}</h4>
                  <p className="text-sm text-neutral-500 mb-2">{goal.category}</p>
                  <div className="text-xs text-neutral-400">
                    Completed {timeAgo(goal.updatedAt)}
                  </div>
                  <Link 
                    to={`/goals/${goal.id}`}
                    className="btn btn-outline btn-sm mt-3"
                  >
                    View Details
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
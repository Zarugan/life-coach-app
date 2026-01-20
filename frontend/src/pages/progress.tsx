import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { 
  ChartBarIcon,
  CalendarIcon,
  TrophyIcon,
  UserGroupIcon,
  DocumentTextIcon,
  TrendingUpIcon
} from '@heroicons/react/24/outline'
import { Card, CardHeader, CardBody, Progress, Badge } from '@/components/ui'
import { formatDateTime } from '@/utils'

export default function Progress() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)

  const { data: progress, isLoading } = useQuery(
    ['progress', timeRange],
    () => fetch(`/api/progress?period=${timeRange}`).then(res => res.json()),
    {
      keepPreviousData: true
    }
  )

  const { data: goals } = useQuery(
    'goals',
    () => fetch('/api/goals?status=active').then(res => res.json())
  )

  const markMilestoneMutation = useMutation(
    async ({ goalId, milestone }) => {
      const response = await fetch('/api/progress/milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, milestone })
      })

      if (!response.ok) {
        throw new Error('Failed to mark milestone')
      }

      return response.json()
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('progress')
        queryClient.invalidateQueries('goals')
        queryClient.invalidateQueries('stats')
      }
    }
  )

  const updateProgressMutation = useMutation(
    async ({ goalId, value, notes }) => {
      const response = await fetch('/api/progress/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, value, notes })
      })

      if (!response.ok) {
        throw new Error('Failed to update progress')
      }

      return response.json()
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('progress')
        queryClient.invalidateQueries('goals')
      }
    }
  }

  const timeRanges = [
    { value: 'week', label: 'This Week', days: 7 },
    { value: 'month', label: 'This Month', days: 30 },
    { value: 'year', label: 'This Year', days: 365 }
  ]

  const totalProgress = progress?.report?.totalGoals || 0
  const completedProgress = progress?.report?.completedGoals || 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Progress</h1>
          <p className="text-neutral-500 mt-1">Track your journey and celebrate achievements</p>
        </div>
        <select 
          value={timeRange} 
          onChange={(e) => setTimeRange(e.target.value as string)}
          className="border border-neutral-300 rounded-md px-4 py-2 text-sm"
        >
          {timeRanges.map(range => (
            <option key={range.value} value={range.value}>{range.label}</option>
          ))}
        </select>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="text-center">
            <TrophyIcon className="w-12 h-12 text-warning-600 mx-auto mb-3" />
          </CardHeader>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-warning-600">{totalProgress}</div>
            <p className="text-sm text-neutral-500">Total Goals</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <ChartBarIcon className="w-12 h-12 text-primary-600 mx-auto mb-3" />
          </CardHeader>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-success-600">{completedProgress}</div>
            <p className="text-sm text-neutral-500">Completed</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <TrendingUpIcon className="w-12 h-12 text-success-600 mx-auto mb-3" />
          </CardHeader>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-primary-600">
              {totalProgress > 0 ? Math.round((completedProgress / totalProgress) * 100) : 0}%
            </div>
            <p className="text-sm text-neutral-500">Success Rate</p>
          </CardBody>
        </Card>
      </div>

      {/* Progress Report */}
      {progress?.report && (
        <Card>
          <CardHeader>
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">
              {timeRange.charAt(0).toUpperCase() + timeRange.slice(1)} Progress Report
            </h3>
            <DocumentTextIcon className="w-5 h-5 text-primary-600" />
          </CardHeader>
          <CardBody>
            <div className="prose max-w-none text-sm text-neutral-600 mb-4">
              {progress.report.summary}
            </div>
            
            {/* Goals Progress */}
            <div className="space-y-4">
              <h4 className="font-semibold text-neutral-900 mb-3">Goals Progress</h4>
              <div className="space-y-3">
                {goals?.map((goal) => {
                  const progressData = progress.report.goalsProgress?.find(g => g.id === goal.id)
                  if (!progressData) return null

                  return (
                    <div key={goal.id} className="border border-neutral-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-neutral-900">{goal.title}</h5>
                              <Badge variant="primary" className="mt-1">
                                {goal.category}
                              </Badge>
                              <Badge variant={goal.priority === 'high' ? 'danger' : 'warning'} className="mt-1 ml-2">
                                {goal.priority}
                              </Badge>
                            </div>
                          </div>
                        <div className="text-right">
                          <div className="text-sm text-neutral-500">
                            {formatDateTime(goal.updatedAt)}
                          </div>
                        </div>
                      </div>
                      
                      <Progress 
                        value={progressData.percentage} 
                        color={progressData.percentage >= 80 ? 'success' : progressData.percentage >= 50 ? 'warning' : 'primary'}
                      />
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-sm text-neutral-600">
                          {progressData.currentValue || 0} / {progressData.targetValue || 100}
                        </span>
                        <span className="text-sm font-medium">
                          ({progressData.percentage || 0}%)
                        </span>
                      </div>
                      </div>
                      
                      <div className="flex space-x-3 mt-4">
                        <button 
                          onClick={() => navigate(`/goals/${goal.id}`)}
                          className="btn btn-outline btn-sm flex-1"
                        >
                          View Details
                        </button>
                        {progressData.percentage < 100 && (
                          <button
                            onClick={() => updateProgressMutation.mutate({
                              goalId: goal.id,
                              value: progressData.currentValue + 1,
                              notes: 'Quick progress update'
                            })}
                            className="btn btn-primary btn-sm flex-1"
                          >
                            +1
                          </button>
                        )}
                      </div>
                    </div>
                  )
                }).filter(Boolean)}
              </div>
            </div>

            {/* Recent Achievements */}
            <div className="space-y-4">
              <h4 className="font-semibold text-neutral-900 mb-3">Recent Achievements</h4>
              <div className="space-y-2">
                {progress.report.achievements?.map((achievement, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50">
                    <Badge variant="success">
                      <TrophyIcon className="w-4 h-4" />
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900">{achievement.title}</p>
                      <p className="text-sm text-neutral-500 text-xs mt-1">
                        {achievement.description}
                      </p>
                    </div>
                    <div className="text-xs text-neutral-400">
                      {formatDateTime(achievement.achievedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Recommendations */}
      {progress?.report?.recommendations && (
        <Card>
          <CardHeader>
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">
              Recommendations
            </h3>
            <TrendingUpIcon className="w-5 h-5 text-primary-600" />
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {progress.report.recommendations.map((rec, index) => (
                <div key={index} className="border-l-4 border-primary-300 bg-primary-50 p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {rec.priority === 'high' && (
                        <div className="w-2 h-2 bg-danger-600 rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-neutral-900 mb-1">{rec.title}</h5>
                      <p className="text-sm text-neutral-600 text-xs">{rec.description}</p>
                    </div>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
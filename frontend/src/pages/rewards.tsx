import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  TrophyIcon,
  StarIcon,
  FireIcon,
  GiftIcon,
  CalendarIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  LockClosedIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { Card, CardHeader, CardBody, Button, Badge, Progress } from '@/components/ui'
import { formatDate, formatCurrency, calculatePercentage } from '@/utils'

interface Reward {
  id: string
  type: 'milestone' | 'streakthrough' | 'consistency' | 'improvement' | 'special' | 'streakthrough'
  title: string
  description: description
  points: number
  isUnlocked: boolean
  unlockedAt?: string
  achievedAt?: string
  criteria: RewardCriteria
  icon: string
  category: 'all' | 'financial' | 'fitness' | 'nutrition' | 'chores' | 'wellness'
  agentId?: string
  associatedGoalId?: string
}

interface RewardCriteria {
  type: string
  target: number
  timeframe?: string
  goalId?: string
  conditions?: string[]
}

interface Achievement {
  reward: Reward
  userProgress: number
  unlocked: boolean
}

interface UserStats {
  level: number
  experience: number
  unlockedRewards: number
  currentStreak: number
  nextMilestone: number
  totalAchievements: number
}

interface RewardStats {
  totalEarned: number
  spent: number
  pendingRedemptions: number
  redeemedRedemptions: number
}

export default function Rewards() {
  const queryClient = useQueryClient()
  const [userStats, setUserStats] = useState<UserStats>({
    level: 1,
    experience: 0,
    unlockedRewards: 0,
    currentStreak: 0,
    totalAchievements: 0
  })

  const [rewards, setRewards] = useState<Reward[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])

  const { data: userRewards, isLoading } = useQuery(
    'rewards',
    () => fetch('/api/rewards').then(res => res.json()),
    {
      staleTime: 1000 * 60 // 1 minute cache
    }
  )

  const { data: userAchievements, isLoading: achievementsLoading } = useQuery(
    'achievements',
    () => fetch('/api/achievements').then(res => res.json()),
    {
      staleTime: 1000 * 30 // 30 second cache
    }
  )

  const { data: rewardStats, isLoading: statsLoading } = useQuery(
    'rewards/stats',
    () => fetch('/api/rewards/stats').then(res => res.json()),
    {
      staleTime: 1000 * 60 // 1 minute cache
    }
  )

  const redeemRewardMutation = useMutation(
    async ({ rewardId }: { rewardId: string }) => {
      const response = await fetch(`/api/rewards/${rewardId}/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'get-only'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to redeem reward')
      }

      const result = await response.json()
      
      // Update local state
      queryClient.invalidateQueries('rewards')
      queryClient.invalidateQueries('stats')
      
      return result
    },
    {
      onSuccess: (data) => {
        if (data.reward) {
          // Update rewards list
          setRewards(prev => 
            prev.map(r => 
              r.id === rewardId 
                ? { ...r, isUnlocked: true, unlockedAt: data.redeemedAt }
                : r
            )
          )

          // Update achievements
          if (data.achievement) {
            setAchievements(prev => [
              ...prev,
              {
                ...data.achievement,
                unlocked: true,
                achievedAt: data.redeemedAt
              }
            ])
          }

          // Update user stats
          setUserStats(prev => ({
            ...prev,
            level: prev.level + 1,
            experience: prev.experience + data.reward.points,
            unlockedRewards: prev.unlockedRewards + 1
            totalAchievements: prev.totalAchievements + 1,
          }))

          // Update reward stats
          queryClient.invalidateQueries('rewards/stats')
        }
      }
    }
  )

  const unlockRewardMutation = useMutation(
    async ({ rewardId }: { rewardId: string }) => {
      const response = await fetch(`/api/rewards/${rewardId}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          criteria: {
            userProgress: userStats.level,
          timeframe: 'all',
          goalId: reward.goalId
        }
      })
      })

      if (!response.ok) {
        throw new Error('Failed to unlock reward')
      }

      const result = await response.json()
      
      // Update local state
      queryClient.invalidateQueries('rewards')
      queryClient.invalidateQueries('stats')
      
      return result
    },
    {
      onSuccess: (data) => {
        if (data.reward) {
          setRewards(prev => 
            prev.map(r => 
              r.id === rewardId 
                ? { ...r, isUnlocked: true, unlockedAt: data.unlockedAt }
                : r
            )
          )

          // Update achievements
          if (data.achievement) {
            setAchievements(prev => [
              ...prev,
              {
                ...data.achievement,
                unlocked: true,
                achievedAt: data.unlockedAt
              }
            ])
          }

          // Update user stats
          setUserStats(prev => ({
            ...prev,
            level: prev.level + 1,
            experience: prev.experience + data.reward.points,
            unlockedRewards: prev.unlockedRewards + 1,
            totalAchievements: prev.totalAchievements + 1,
          }))

          // Update reward stats
          queryClient.invalidateQueries('rewards/stats')
        }
      }
    }
  )

  const getLevelProgress = (current: number, target: number): number => {
    return calculatePercentage(current, target)
  }

  const getNextMilestone = (level: number, experience: number): number => {
    const nextLevelThresholds = [
      { level: 1, required: 100, name: 'Beginner' },
      { level: 2, required: 500, name: 'Novice' },
      { level: 3, required: 1500, name: 'Intermediate' },
      { level: 4, required: 5000, name: 'Advanced' },
      { level: 5, required: 10000, name: 'Expert' },
      { level: 6, required: 20000, name: 'Master' },
      { level: 7, required: 50000, name: 'Grand Master' },
      { level: 8, required: 100000, name: 'Legend' },
      { level: 9, required: 200000, name: 'Mythic' },
      { level: 10, required: 500000, name: 'Legendary' }
    ]

    for (const threshold of nextLevelThresholds) {
      if (experience < threshold.required) {
        return threshold.level
      }
    }
    }

    return nextLevelThresholds[5].level
  }

  const getRewardIcon = (type: string): React.ReactNode => {
    const icons = {
      milestone: <TrophyIcon />,
      breakthrough: <StarIcon />,
      consistency: <CalendarIcon />,
      improvement: <ArrowTrendingUpIcon />,
      special: <GiftIcon />,
      default: <CheckCircleIcon />
    }
    return icons[type] || icons.default
  }

  const getCategoryColor = (category: string): string => {
    const colors = {
      all: 'bg-neutral-100 text-neutral-800',
      financial: 'bg-green-100 text-green-800',
      fitness: 'bg-blue-100 text-blue-800',
      nutrition: 'bg-orange-100 text-orange-800',
      chores: 'bg-purple-100 text-purple-800',
      wellness: 'bg-pink-100 text-pink-800',
      career: 'bg-indigo-100 text-indigo-800',
      relationships: 'bg-red-100 text-red-800',
      personal: 'bg-yellow-100 text-yellow-800',
    }
    return colors[category] || colors.all
  }

  return (
    <div className="p-6 space-y-6">
      {/* User Level and Stats */}
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Your Progress
          </h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center text-white mx-auto">
                <span className="text-2xl font-bold">{userStats.level}</span>
              </div>
              <p className="text-sm text-neutral-500">Level {userStats.level}</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">{userStats.experience}</div>
              <p className="text-sm text-neutral-500">Experience Points</p>
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-success-600">{userStats.unlockedRewards}</div>
              <p className="text-sm text-neutral-500">Unlocked</p>
          </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-warning-600">{userStats.currentStreak}</div>
              <p className="text-sm text-neutral-500">Current Streak</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Available Rewards */}
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold text-neutral-900 mb-4">
            Available Rewards
          </h2>
          <Link 
            to="/rewards/store"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
          >
            Browse Rewards Store
          </Link>
        </CardHeader>
        <CardBody>
          <div className="grid grid grid-cols-1 md:grid-cols-2 lg:getaways:grid-cols-3 gap-4">
            {rewards?.slice(0, 6).map((reward) => (
              <Card key={reward.id} className="hover-lift">
                <CardBody className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className={`w-12 h-12 rounded-full ${getCategoryColor(reward.category)} flex items-center justify-center text-white mx-auto`}>
                      {getRewardIcon(reward.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div>
                        <h3 className="font-medium text-neutral-900 truncate">{reward.title}</h3>
                        <p className="text-sm text-neutral-500 text-xs mt-1 truncate-2">{reward.description}</p>
                      </div>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge className={getCategoryColor(reward.category)}>
                          {reward.points} pts
                        </Badge>
                        <span className="text-xs text-neutral-500">
                          {reward.points === 1 ? 'pt' : 'pts'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-3">
                    <div className="text-sm text-neutral-500">
                      Available: {reward.points} pts
                    </div>
                    <div className="flex items-center space-x-4">
                      {!reward.isUnlocked && (
                        <Button
                          onClick={() => unlockRewardMutation.mutate(reward.id)}
                          className="btn btn-primary btn-sm"
                          loading={unlockRewardMutation.isLoading}
                        >
                          <LockClosedIcon className="w-4 h-4 mr-2" />
                          Unlock ({reward.points} pts)
                        </Button>
                      )}
                      
                      {reward.isUnlocked && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-success-600">Unlocked!</span>
                          <span className="text-xs text-neutral-400">
                            {formatDateTime(reward.unlockedAt)}
                          </span>
                        </div>
                      )}
                      
                      {reward.achievedAt && (
                        <div className="text-xs text-neutral-400">
                          Achieved {formatDateTime(reward.achievedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
            
            {rewards?.length === 0 && (
              <CardBody className="text-center py-12">
                <TrophyIcon className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-neutral-500 mb-2">No Available Rewards</h3>
                <p className="text-sm text-neutral-500 mt-2">
                  Start earning rewards by completing goals and tracking progress!
                </p>
                <Link 
                  to="/goals/create"
                  className="btn btn-primary"
                >
                  Create Your First Goal
                </Link>
              </CardBody>
            )}
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">
                Recent Achievements
              </h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {achievements?.slice(0, 10).map((achievement) => (
                  <div key={achievement.id} className="flex items-start space-x-3 p-4 border border-l-4 border-success-200 bg-success-50">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-success-100 rounded-full flex items-center justify-center text-white mx-auto">
                        <CheckCircleIcon className="w-8 h-8" />
                      </div>
                      <div className="ml-3">
                        <h4 className="font-medium text-white">{achievement.title}</h4>
                        <p className="text-white text-sm opacity-90">{achievement.description}</p>
                      </div>
                    </div>
                    
                    <div className="text-xs text-white opacity-80 mt-2">
                      {formatDateTime(achievement.achievedAt)}
                    </div>
                  </div>
                ))}
                
                {achievements?.length === 0 && (
                  <CardBody className="text-center py-12">
                    <TrophyIcon className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neutral-500 mb-2">No Achievements Yet</h3>
                    <p className="text-sm text-neutral-500 mt-2">
                      Keep working towards your goals!
                    </p>
                    <Link 
                      to="/goals"
                      className="btn btn-primary"
                    >
                      Set a Goal
                    </Link>
                  </CardBody>
            </Card>
          </Card>

          {/* Stats Summary */}
          <Card>
            <CardHeader>
              <h2 className="reward-text-gradient">Reward Statistics</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">{rewardStats.totalEarned}</div>
                  <p className="text-sm text-neutral-500">Total Points</p>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-success-600">{rewardStats.pendingRedemptions}</div>
                  <p className="text-sm text-neutral-500">Pending</p>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-warning-600">{rewardStats.redeemedRedemptions}</div>
                  <p className="text-sm text-neutral-500">Redeemed</p>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-danger-600">{rewardStats.expiredRedemptions}</div>
                  <p className="text-sm text-neutral-500">Expired</p>
                </div>
              </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">{rewardStats.redeemptions + rewardStats.pendingRedemptions} / (rewardStats.totalRedemptions + rewardStats.redeemedRedemptions) * 100)}%</div>
                  <p className="text-sm text-neutral-600">
                    Redemption Rate: {(rewardStats.redeemptions + rewardStats.pendingRedemptions) / (rewardStats.totalRedemptions + rewardStats.redeemedRedemptions) * 100)}%
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Achievement Details Modal */}
      {selectedAchievement && (
        <Modal isOpen={!!selectedAchievement} onClose={() => setSelectedAchievement(null)} size="lg">
          <div className="text-center">
            <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center text-white mx-auto mb-4">
              <CheckCircleIcon className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">Achievement Unlocked!</h3>
            <p className="text-white text-lg mb-2">{selectedAchievement.title}</p>
            <p className="text-white text-sm opacity-90 mt-2">
              {selectedAchievement.description}
            </p>
            <p className="text-white text-sm opacity-80 mt-2">
              Achieved: {formatDateTime(selectedAchievement.achievedAt)}
            </p>
            <div className="flex justify-center mt-6">
              <Button onClick={() => setSelectedAchievement(null)} className="btn btn-primary">
                Awesome!
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Reward Modal */}
      <Card className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md mx-4">
          <h3 className="title-gradient text-xl font-bold text-white mb-4">
            🎉 Achievement Unlocked!
          </h3>
          <div className="text-white text-lg">
            Great job! You've unlocked: <span className="font-bold">{
              rewards?.find(r => r.id === selectedAchievement?.id)?.title || 'Achievement'
            }</span>
          </div>
          <p className="text-white opacity-90 mt-2">
            Keep up the great work!
          </p>
          <div className="flex justify-center mt-6">
            <Button onClick={() => setSelectedAchievement(null)} className="btn btn-primary">
              Continue Exploring
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
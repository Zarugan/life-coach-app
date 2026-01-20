import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  UserCircleIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import { Button, Card, CardHeader, CardBody, Input } from '@/components/ui'

export default function Profile() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'privacy' | 'agents'>('profile')

  const { data: user, isLoading } = useQuery(
    'user',
    () => fetch('/api/user').then(res => res.json())
  )

  const updateProfileMutation = useMutation(
    async (profileData: any) => {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      return response.json()
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('user')
        queryClient.invalidateQueries('auth')
      }
    }
  )

  const updatePreferencesMutation = useMutation(
    async (preferences: any) => {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      })

      if (!response.ok) {
        throw new Error('Failed to update preferences')
      }

      return response.json()
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('user')
        queryClient.invalidateQueries('auth')
      }
    }
  )

  const { data: agents } = useQuery(
    'agents',
    () => fetch('/api/agents').then(res => res.json())
  )

  const toggleAgentMutation = useMutation(
    async ({ agentId, enabled }) => {
      const response = await fetch('/api/user/agents', {
        method: 'PUT',
        headers: { { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, enabled })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle agent')
      }

      return response.json()
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('agents')
      }
    }
  )

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    preferences: {
      notifications: {
        email: true,
        push: true,
        sms: false,
        frequency: 'daily',
        agentUpdates: true,
        goalReminders: true
      },
      privacy: {
        dataSharing: false,
        analytics: true,
        thirdPartyIntegrations: false,
        locationServices: true,
        publicProfile: false
      },
      agents: {
        financialAdvisor: true,
        dietitian: true,
        fitnessTrainer: true,
        choreManager: true,
        digitalWellness: true,
        autoCoordination: true
      }
  })

  React.useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        preferences: user.preferences
      })
    }
  }, [user])

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const profileData = {
      name: formData.name,
      email: formData.email
    }
    
    updateProfileMutation.mutate(profileData)
  }

  const handlePreferencesSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updatePreferencesMutation.mutate(formData.preferences)
  }

  const handleAgentToggle = (agentId: string) => {
    const agent = agents?.find(a => a.id === agentId)
    if (!agent) return
      
    toggleAgentMutation.mutate({
      agentId,
      enabled: !agent.isActive
    })
  }

  const getTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-neutral-900">Profile Information</h2>
                <UserCircleIcon className="w-6 h-6 text-primary-600" />
              </CardHeader>
              <CardBody>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <Input
                      label="Full Name"
                      name="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter your full name"
                    />
                  </div>
                  
                  <div>
                    <Input
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="your.email@example.com"
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button type="submit" loading={updateProfileMutation.isLoading}>
                      Save Changes
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-neutral-900">Account Settings</h2>
                <Cog6ToothIcon className="w-6 h-6 text-primary-600" />
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">Email Notifications</span>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          notifications: {
                            ...prev.preferences.notifications,
                            email: !prev.preferences.notifications.email
                          }
                        }
                      }))}
                      className={`btn ${formData.preferences.notifications.email ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    >
                      {formData.preferences.notifications.email ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">Push Notifications</span>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          notifications: {
                            ...prev.preferences.notifications,
                            push: !prev.preferences.notifications.push
                          }
                        }
                      }))}
                      className={`btn ${formData.preferences.notifications.push ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    >
                      {formData.preferences.notifications.push ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">SMS Notifications</span>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          notifications: {
                            ...prev.preferences.notifications,
                            sms: !prev.preferences.notifications.sms
                          }
                        }
                      }))}
                      className={`btn ${formData.preferences.notifications.sms ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    >
                      {formData.preferences.notifications.sms ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-neutral-900">Notification Preferences</h2>
                <BellIcon className="w-6 h-6 text-primary-600" />
              </CardHeader>
              <CardBody>
                <form onSubmit={handlePreferencesSubmit} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">Notification Frequency</label>
                    <select
                      value={formData.preferences.notifications.frequency}
                      onChange={(e) => setFormData({...formData, preferences: {
                        ...formData.preferences,
                        notifications: {
                          ...formData.preferences.notifications,
                          frequency: e.target.value as string
                        }
                      })}
                      className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">Agent Updates</label>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          notifications: {
                            ...prev.preferences.notifications,
                            agentUpdates: !prev.preferences.notifications.agentUpdates
                          }
                        }
                      }))}
                      className={`btn ${formData.preferences.notifications.agentUpdates ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    >
                      {formData.preferences.notifications.agentUpdates ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">Goal Reminders</label>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          notifications: {
                            ...prev.preferences.notifications,
                            goalReminders: !prev.preferences.notifications.goalReminders
                          }
                        }
                      }))}
                      className={`btn ${formData.preferences.notifications.goalReminders ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    >
                      {formData.preferences.notifications.goalReminders ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        )

      case 'privacy':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-neutral-900">Privacy Settings</h2>
                <ShieldCheckIcon className="w-6 h-6 text-primary-600" />
              </CardHeader>
              <CardBody>
                <form onSubmit={handlePreferencesSubmit} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">Data Sharing</label>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          privacy: {
                            ...prev.preferences.privacy,
                            dataSharing: !prev.preferences.privacy.dataSharing
                          }
                        }
                      }))}
                      className={`btn ${formData.preferences.privacy.dataSharing ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    >
                      {formData.preferences.privacy.dataSharing ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">Analytics</label>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          privacy: {
                            ...prev.preferences.privacy,
                            analytics: !prev.preferences.privacy.analytics
                          }
                        }
                      }))}
                      className={`btn ${formData.preferences.privacy.analytics ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    >
                      {formData.preferences.privacy.analytics ? 'Enabled' : 'disabled'}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">Third-Party Integrations</label>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          privacy: {
                            ...prev.preferences.privacy,
                            thirdPartyIntegrations: !prev.preferences.privacy.thirdPartyIntegrations
                          }
                        }
                      }))}
                      className={`btn ${formData.preferences.privacy.thirdPartyIntegrations ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    >
                      {formData.preferences.privacy.thirdPartyIntegrations ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">Location Services</label>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          privacy: {
                            ...prev.preferences.privacy,
                            locationServices: !prev.preferences.privacy.locationServices
                          }
                        }
                      }))}
                      className={`btn ${formData.preferences.privacy.locationServices ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    >
                      {formData.preferences.privacy.locationServices ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">Public Profile</label>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          privacy: {
                            ...prev.preferences.privacy,
                            publicProfile: !prev.preferences.privacy.publicProfile
                          }
                        }
                      }))}
                      className={`btn ${formData.preferences.privacy.publicProfile ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    >
                      {formData.preferences.privacy.publicProfile ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  
                  <div className="flex justify-end mt-6">
                    <Button type="submit" loading={updatePreferencesMutation.isLoading}>
                      Save Privacy Settings
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        )

      case 'agents':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-neutral-900">Agent Settings</h2>
                <UserGroupIcon className="w-6 h-6 text-primary-600" />
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {agents?.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl">
                            {agent.type === 'financial-advisor' && '💰'}
                            {agent.type === 'dietitian' && '🥗'}
                            {agent.type === 'fitness-trainer' && '💪'}
                            {agent.type === 'chore-manager' && '🏠'}
                            {agent.type === 'digital-wellness' && '🧘'}
                            {agent.type === 'lead-coordinator' && '🧠'}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-neutral-900">{agent.name}</h3>
                          <p className="text-sm text-neutral-500">{agent.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <button
                          onClick={() => handleAgentToggle(agent.id)}
                          className={`btn ${agent.isActive ? 'btn-outline' : 'btn-primary'} btn-sm`}
                          loading={toggleAgentMutation.isLoading}
                        >
                          {agent.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-sm text-neutral-600 mt-2">
                      Last active: {agent.lastActivity ? formatDateTime(agent.lastActivity) : 'Never'}
                    </div>
                    
                    <p className="text-xs text-neutral-400 mt-1">
                      {agent.capabilities.join(', ')}
                    </p>
                  </div>
                </div>
              ))}
                </div>
              </CardBody>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* User Info */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-16 h-16 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">{user?.name || 'User'}</h2>
          <p className="text-neutral-500">{user?.email || 'user@example.com'}</p>
          <p className="text-xs text-neutral-400">Member since {formatDateTime(user?.createdAt || new Date())}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6">
        {['profile', 'notifications', 'privacy', 'agents'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
              activeTab === tab
                ? 'bg-primary-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {getTabContent()}
    </div>
  )
}
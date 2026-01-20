export interface User {
  id: string
  email: string
  name: string
  preferences: UserPreferences
  createdAt: string
}

export interface UserPreferences {
  notifications: NotificationSettings
  privacy: PrivacySettings
  agents: AgentSettings
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  sms: boolean
  frequency: 'immediate' | 'daily' | 'weekly'
  agentUpdates: boolean
  goalReminders: boolean
}

export interface PrivacySettings {
  dataSharing: boolean
  analytics: boolean
  thirdPartyIntegrations: boolean
  locationServices: boolean
  publicProfile: boolean
}

export interface AgentSettings {
  financialAdvisor: boolean
  dietitian: boolean
  fitnessTrainer: boolean
  choreManager: boolean
  digitalWellness: boolean
  autoCoordination: boolean
}

export interface Goal {
  id: string
  category: GoalCategory
  title: string
  description: string
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

export type GoalCategory = 
  | 'financial'
  | 'health'
  | 'fitness'
  | 'nutrition'
  | 'chores'
  | 'wellness'
  | 'career'
  | 'relationships'
  | 'personal'

export interface Agent {
  id: string
  type: AgentType
  name: string
  description: string
  capabilities: string[]
  status: 'active' | 'inactive' | 'maintenance'
  lastActivity?: string
  isActive: boolean
}

export type AgentType = 
  | 'lead-coordinator'
  | 'financial-advisor'
  | 'dietitian'
  | 'fitness-trainer'
  | 'chore-manager'
  | 'digital-wellness'

export interface Receipt {
  id: string
  merchant: string
  amount: number
  currency: string
  category: string
  date: string
  items: ReceiptItem[]
  imageUrl?: string
  processedAt: string
}

export interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  category: string
}

export interface Message {
  id: string
  agentId?: string
  content: string
  type: 'user' | 'agent' | 'system'
  timestamp: string
  metadata?: MessageMetadata
}

export interface MessageMetadata {
  agentType?: AgentType
  confidence?: number
  relatedGoalId?: string
  attachments?: string[]
  crossAgentCommunication?: boolean
}

export interface ProgressEntry {
  id: string
  goalId: string
  agentId: string
  type: ProgressType
  value: number
  unit?: string
  notes?: string
  timestamp: string
}

export type ProgressType = 
  | 'metric'
  | 'task_completion'
  | 'habit_formation'
  | 'milestone'
  | 'setback'

export interface ChangelogEntry {
  id: string
  type: ChangelogType
  title: string
  description: string
  agentId?: string
  goalId?: string
  impact: 'positive' | 'negative' | 'neutral'
  tags: string[]
  timestamp: string
}

export type ChangelogType = 
  | 'goal_created'
  | 'goal_completed'
  | 'milestone_reached'
  | 'habit_formed'
  | 'setback'
  | 'insight'
  | 'recommendation'
  | 'breakthrough'

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
  }
}

// Component Props
export interface BaseProps {
  className?: string
  children?: React.ReactNode
}

export interface ButtonProps extends BaseProps {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export interface InputProps extends BaseProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel'
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  error?: string
  disabled?: boolean
  required?: boolean
  label?: string
  icon?: React.ReactNode
}

export interface CardProps extends BaseProps {
  title?: string
  description?: string
  footer?: React.ReactNode
  image?: string
  actions?: React.ReactNode
  hover?: boolean
}

export interface ModalProps extends BaseProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick?: boolean
  showCloseButton?: boolean
}

// Chart Data Types
export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
  }[]
}

export interface SpendingAnalytics {
  totalSpent: number
  categoryBreakdown: {
    category: string
    amount: number
    percentage: number
  }[]
  trends: {
    period: string
    amount: number
    change: number
  }[]
}

// Notification Types
export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
}

// Location Types
export interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number
  timestamp: string
}

export interface NearbyPlace {
  id: string
  name: string
  category: string
  distance: number
  rating?: number
  address: string
  imageUrl?: string
  agentInsights: Record<string, any>
}

export interface AreaSafety {
  overallRisk: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
  riskScore: number
  factors: {
    crime: CrimeData
    environmental: EnvironmentalData
    infrastructure: InfrastructureData
  }
  recommendations: string[]
}

export interface CrimeData {
  overallCrimeRate: string
  recentIncidents: number
  crimeTypes: Record<string, string>
}

export interface EnvironmentalData {
  airQuality: string
  noiseLevel: string
  lighting: string
  walkability: string
}

export interface InfrastructureData {
  roadQuality: string
  sidewalkCondition: string
  streetLighting: string
  publicTransport: string
}

// Form Types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio'
  placeholder?: string
  required?: boolean
  validation?: {
    min?: number
    max?: number
    pattern?: string
    custom?: (value: any) => string | undefined
  }
  options?: Array<{ label: string; value: string }>
}

export interface FormData {
  [key: string]: any
}

// Error Types
export interface FormError {
  field: string
  message: string
}

export interface ApiError {
  code: string
  message: string
  details?: any
}

// Theme Types
export type Theme = 'light' | 'dark'

export interface ThemeConfig {
  colors: {
    primary: string
    secondary: string
    success: string
    warning: string
    danger: string
    neutral: string
    background: string
    surface: string
    text: string
  }
}

// Utility Types
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void
  cancel: () => void
}
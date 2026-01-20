export interface User {
  id: string;
  email: string;
  name: string;
  preferences: UserPreferences;
  goals: Goal[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  currency: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  agents: AgentSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
}

export interface PrivacySettings {
  dataSharing: boolean;
  analytics: boolean;
  thirdPartyIntegrations: boolean;
}

export interface AgentSettings {
  financial: boolean;
  dietitian: boolean;
  fitness: boolean;
  chore: boolean;
  wellness: boolean;
  autoCoordination: boolean;
}

export interface Goal {
  id: string;
  userId: string;
  category: GoalCategory;
  title: string;
  description: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  deadline?: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  agentIds: string[];
  createdAt: Date;
  updatedAt: Date;
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
  | 'personal';

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  capabilities: string[];
  status: 'active' | 'inactive' | 'maintenance';
  config: AgentConfig;
}

export type AgentType = 
  | 'lead-coordinator'
  | 'financial-advisor'
  | 'dietitian'
  | 'fitness-trainer'
  | 'chore-manager'
  | 'digital-wellness';

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  tools: Tool[];
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface Message {
  id: string;
  userId: string;
  agentId?: string;
  content: string;
  type: 'user' | 'agent' | 'system';
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  agentType?: AgentType;
  confidence?: number;
  relatedGoalId?: string;
  attachments?: string[];
  crossAgentCommunication?: boolean;
}

export interface ProgressEntry {
  id: string;
  userId: string;
  goalId: string;
  agentId: string;
  type: ProgressType;
  value: number;
  unit?: string;
  notes?: string;
  evidence?: string[];
  timestamp: Date;
}

export type ProgressType = 
  | 'metric'
  | 'task_completion'
  | 'habit_formation'
  | 'milestone'
  | 'setback';

export interface ChangelogEntry {
  id: string;
  userId: string;
  type: ChangelogType;
  title: string;
  description: string;
  agentId?: string;
  goalId?: string;
  impact: 'positive' | 'negative' | 'neutral';
  tags: string[];
  timestamp: Date;
}

export type ChangelogType = 
  | 'goal_created'
  | 'goal_completed'
  | 'milestone_reached'
  | 'habit_formed'
  | 'setback'
  | 'insight'
  | 'recommendation'
  | 'breakthrough';

export interface Receipt {
  id: string;
  userId: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  date: Date;
  items: ReceiptItem[];
  imageUrl?: string;
  processedAt: Date;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string;
}

export interface MealPlan {
  id: string;
  userId: string;
  name: string;
  duration: number;
  meals: Meal[];
  nutritionalInfo: NutritionalInfo;
  createdAt: Date;
}

export interface Meal {
  id: string;
  name: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipe: Recipe;
  scheduledTime: Date;
  completed: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  nutritionalInfo: NutritionalInfo;
  dietaryRestrictions: string[];
  cost?: number;
}

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

export interface NutritionalInfo {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  vitamins?: Record<string, number>;
  minerals?: Record<string, number>;
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  duration: number;
  workouts: Workout[];
  goals: string[];
  createdAt: Date;
}

export interface Workout {
  id: string;
  name: string;
  type: 'cardio' | 'strength' | 'flexibility' | 'balance' | 'sports';
  exercises: Exercise[];
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  scheduledTime: Date;
  completed: boolean;
}

export interface Exercise {
  name: string;
  sets?: number;
  reps?: number;
  duration?: number;
  weight?: number;
  restTime?: number;
  instructions: string[];
  muscleGroups: string[];
}

export interface ChoreTask {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: ChoreCategory;
  priority: 'low' | 'medium' | 'high';
  estimatedTime: number;
  scheduledTime?: Date;
  completed: boolean;
  subtasks: Subtask[];
  createdAt: Date;
}

export type ChoreCategory = 
  | 'kitchen'
  | 'bathroom'
  | 'bedroom'
  | 'living-room'
  | 'outdoor'
  | 'maintenance'
  | 'organizational'
  | 'laundry';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  estimatedTime: number;
}

export interface DigitalWellnessMetrics {
  screenTime: number;
  appUsage: Record<string, number>;
  focusSessions: number;
  distractionBlocks: number;
  socialMediaTime: number;
  gamingTime: number;
  productiveTime: number;
  date: Date;
}

export interface Reward {
  id: string;
  userId: string;
  type: RewardType;
  title: string;
  description: string;
  points: number;
  unlocked: boolean;
  unlockedAt?: Date;
  criteria: RewardCriteria;
}

export type RewardType = 
  | 'milestone'
  | 'streak'
  | 'improvement'
  | 'consistency'
  | 'breakthrough';

export interface RewardCriteria {
  type: string;
  target: number;
  timeframe?: string;
  goalId?: string;
}

export interface AgentCommunication {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  message: string;
  context: Record<string, any>;
  timestamp: Date;
  response?: string;
  respondedAt?: Date;
}
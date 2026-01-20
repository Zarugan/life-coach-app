import { Agent, AgentType, User, Goal, Message, ProgressEntry, ChangelogEntry } from '../types';
import { AgentCommunicationHub } from '../communication/agent-hub';
import { LocationServices } from '../services/location-services';
import { logger } from '../utils/logger';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';

export class LeadCoordinatorAgent {
  private agent: Agent;
  private communicationHub: AgentCommunicationHub;
  private locationServices: LocationServices;
  private activeAgents: Map<AgentType, Agent> = new Map();

  constructor(communicationHub: AgentCommunicationHub) {
    this.communicationHub = communicationHub;
    this.locationServices = new LocationServices();
    this.agent = {
      id: 'lead-coordinator',
      type: 'lead-coordinator',
      name: 'Lead Coordinator',
      description: 'Central orchestrator managing all specialist agents',
      capabilities: [
        'goal-assessment',
        'agent-coordination',
        'progress-tracking',
        'conflict-resolution',
        'user-communication',
        'priority-management'
      ],
      status: 'active',
      config: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: `You are the Lead Coordinator, a central AI agent that manages a team of specialist life coaching agents. 
        Your role is to:
        1. Assess user goals and priorities
        2. Coordinate between specialist agents (Financial, Dietitian, Fitness, Chore, Digital Wellness)
        3. Resolve conflicts between agent recommendations
        4. Provide unified, coherent guidance to users
        5. Track overall progress and maintain changelog
        6. Ensure agents work together harmoniously
        
        Always consider the user's complete life picture and how different aspects interconnect. 
        Maintain a supportive, encouraging, and professional tone.`,
        tools: []
      }
    };
  }

  async initialize(): Promise<void> {
    try {
      // Register with communication hub
      await this.communicationHub.registerAgent(this.agent);
      
      // Initialize location services
      await this.locationServices.initialize();
      
      // Initialize specialist agents
      await this.initializeSpecialistAgents();
      
      logger.info('Lead Coordinator Agent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Lead Coordinator Agent:', error);
      throw error;
    }
  }

  private async initializeSpecialistAgents(): Promise<void> {
    // This will be implemented when we create the specialist agents
    // For now, we'll register placeholder agents
    const specialistTypes: AgentType[] = [
      'financial-advisor',
      'dietitian',
      'fitness-trainer',
      'chore-manager',
      'digital-wellness'
    ];

    for (const type of specialistTypes) {
      const specialistAgent: Agent = {
        id: `agent-${type}`,
        type,
        name: this.getAgentName(type),
        description: this.getAgentDescription(type),
        capabilities: this.getAgentCapabilities(type),
        status: 'active',
        config: {
          model: 'gpt-4',
          temperature: 0.8,
          maxTokens: 1500,
          systemPrompt: this.getAgentSystemPrompt(type),
          tools: []
        }
      };
      
      this.activeAgents.set(type, specialistAgent);
      await this.communicationHub.registerAgent(specialistAgent);
    }
  }

  async processUserMessage(
    userId: string,
    agentType: AgentType | null,
    message: string,
    goalId?: string
  ): Promise<any> {
    try {
      // Log the message
      await this.logMessage(userId, message, 'user', agentType);

      // Determine which agent(s) should handle this
      const relevantAgents = await this.determineRelevantAgents(userId, agentType, message, goalId);
      
      if (relevantAgents.length === 0) {
        // Handle directly with lead coordinator
        return await this.handleDirectResponse(userId, message, goalId);
      }

      // Coordinate between agents if multiple are relevant
      if (relevantAgents.length > 1) {
        return await this.coordinateAgentResponse(userId, relevantAgents, message, goalId);
      }

      // Single agent response
      const targetAgent = relevantAgents[0];
      return await this.communicationHub.sendMessage(
        this.agent.id,
        targetAgent.id,
        {
          userId,
          message,
          goalId,
          context: await this.getUserContext(userId)
        }
      );

    } catch (error) {
      logger.error('Error processing user message:', error);
      throw error;
    }
  }

  private async determineRelevantAgents(
    userId: string,
    requestedAgent: AgentType | null,
    message: string,
    goalId?: string
  ): Promise<Agent[]> {
    const relevantAgents: Agent[] = [];

    // If user specifically requested an agent, prioritize it
    if (requestedAgent && this.activeAgents.has(requestedAgent)) {
      relevantAgents.push(this.activeAgents.get(requestedAgent)!);
    }

    // Analyze message content for agent relevance
    const messageLower = message.toLowerCase();
    
    // Financial keywords
    if (messageLower.includes('money') || messageLower.includes('budget') || 
        messageLower.includes('spend') || messageLower.includes('save') ||
        messageLower.includes('invest') || messageLower.includes('debt')) {
      if (!relevantAgents.find(a => a.type === 'financial-advisor')) {
        relevantAgents.push(this.activeAgents.get('financial-advisor')!);
      }
    }

    // Nutrition/Food keywords
    if (messageLower.includes('food') || messageLower.includes('diet') || 
        messageLower.includes('meal') || messageLower.includes('recipe') ||
        messageLower.includes('nutrition') || messageLower.includes('eat')) {
      if (!relevantAgents.find(a => a.type === 'dietitian')) {
        relevantAgents.push(this.activeAgents.get('dietitian')!);
      }
    }

    // Fitness/Health keywords
    if (messageLower.includes('exercise') || messageLower.includes('workout') || 
        messageLower.includes('fitness') || messageLower.includes('health') ||
        messageLower.includes('gym') || messageLower.includes('training')) {
      if (!relevantAgents.find(a => a.type === 'fitness-trainer')) {
        relevantAgents.push(this.activeAgents.get('fitness-trainer')!);
      }
    }

    // Chore/Household keywords
    if (messageLower.includes('clean') || messageLower.includes('chore') || 
        messageLower.includes('organize') || messageLower.includes('house') ||
        messageLower.includes('tidy') || messageLower.includes('declutter')) {
      if (!relevantAgents.find(a => a.type === 'chore-manager')) {
        relevantAgents.push(this.activeAgents.get('chore-manager')!);
      }
    }

    // Digital wellness keywords
    if (messageLower.includes('screen time') || messageLower.includes('social media') || 
        messageLower.includes('phone') || messageLower.includes('distraction') ||
        messageLower.includes('focus') || messageLower.includes('addiction')) {
      if (!relevantAgents.find(a => a.type === 'digital-wellness')) {
        relevantAgents.push(this.activeAgents.get('digital-wellness')!);
      }
    }

    // Check goal context
    if (goalId) {
      const goal = await this.getUserGoal(userId, goalId);
      if (goal) {
        const goalAgent = this.activeAgents.get(this.getAgentTypeForGoal(goal.category));
        if (goalAgent && !relevantAgents.find(a => a.id === goalAgent.id)) {
          relevantAgents.push(goalAgent);
        }
      }
    }

    return relevantAgents;
  }

  private async coordinateAgentResponse(
    userId: string,
    agents: Agent[],
    message: string,
    goalId?: string
  ): Promise<any> {
    // Get responses from all relevant agents
    const agentResponses = await Promise.all(
      agents.map(agent => 
        this.communicationHub.sendMessage(
          this.agent.id,
          agent.id,
          {
            userId,
            message,
            goalId,
            context: await this.getUserContext(userId),
            coordinationMode: true
          }
        )
      )
    );

    // Synthesize coordinated response
    const coordinatedResponse = await this.synthesizeResponses(
      userId,
      agentResponses,
      message,
      goalId
    );

    return coordinatedResponse;
  }

  private async synthesizeResponses(
    userId: string,
    responses: any[],
    originalMessage: string,
    goalId?: string
  ): Promise<any> {
    // This would use GPT-4 to synthesize multiple agent responses
    // into a coherent, unified recommendation
    return {
      type: 'coordinated-response',
      agents: responses.map(r => r.agentId),
      content: 'Coordinated response from multiple agents...',
      recommendations: [],
      priority: this.determinePriority(responses),
      nextSteps: []
    };
  }

  private async handleDirectResponse(
    userId: string,
    message: string,
    goalId?: string
  ): Promise<any> {
    // Handle general life coaching questions directly
    return {
      type: 'general-guidance',
      content: 'General life coaching guidance...',
      recommendations: [],
      nextSteps: []
    };
  }

  async recordProgress(
    userId: string,
    goalId: string,
    agentId: string,
    type: string,
    value: number,
    notes?: string
  ): Promise<void> {
    try {
      const db = getDatabase();
      
      const progressEntry: ProgressEntry = {
        id: this.generateId(),
        userId,
        goalId,
        agentId,
        type: type as any,
        value,
        notes,
        timestamp: new Date()
      };

      await db.query(
        `INSERT INTO progress_entries (id, user_id, goal_id, agent_id, type, value, notes, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          progressEntry.id,
          progressEntry.userId,
          progressEntry.goalId,
          progressEntry.agentId,
          progressEntry.type,
          progressEntry.value,
          progressEntry.notes,
          progressEntry.timestamp
        ]
      );

      // Update changelog
      await this.updateChangelog(userId, 'milestone_reached', `Progress recorded: ${type}`, agentId, goalId);

      logger.info(`Progress recorded for user ${userId}, goal ${goalId}`);
    } catch (error) {
      logger.error('Error recording progress:', error);
      throw error;
    }
  }

  async processReceipt(userId: string, imageData: string): Promise<any> {
    try {
      // Send to financial advisor for processing
      const financialAgent = this.activeAgents.get('financial-advisor');
      if (!financialAgent) {
        throw new Error('Financial advisor agent not available');
      }

      return await this.communicationHub.sendMessage(
        this.agent.id,
        financialAgent.id,
        {
          userId,
          type: 'receipt-processing',
          imageData,
          context: await this.getUserContext(userId)
        }
      );

    } catch (error) {
      logger.error('Error processing receipt:', error);
      throw error;
    }
  }

  private async getUserContext(userId: string): Promise<any> {
    try {
      const db = getDatabase();
      
      // Get user's active goals
      const goalsResult = await db.query(
        'SELECT * FROM goals WHERE user_id = $1 AND status = $2',
        [userId, 'active']
      );

      // Get recent progress
      const progressResult = await db.query(
        `SELECT * FROM progress_entries 
         WHERE user_id = $1 
         ORDER BY timestamp DESC 
         LIMIT 10`,
        [userId]
      );

      return {
        goals: goalsResult.rows,
        recentProgress: progressResult.rows,
        preferences: await this.getUserPreferences(userId)
      };
    } catch (error) {
      logger.error('Error getting user context:', error);
      return {};
    }
  }

  private async getUserPreferences(userId: string): Promise<any> {
    try {
      const db = getDatabase();
      const result = await db.query(
        'SELECT preferences FROM users WHERE id = $1',
        [userId]
      );
      return result.rows[0]?.preferences || {};
    } catch (error) {
      logger.error('Error getting user preferences:', error);
      return {};
    }
  }

  private async getUserGoal(userId: string, goalId: string): Promise<any> {
    try {
      const db = getDatabase();
      const result = await db.query(
        'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
        [goalId, userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user goal:', error);
      return null;
    }
  }

  private async logMessage(
    userId: string,
    content: string,
    type: 'user' | 'agent' | 'system',
    agentId?: string
  ): Promise<void> {
    try {
      const db = getDatabase();
      await db.query(
        `INSERT INTO messages (id, user_id, agent_id, content, type, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          this.generateId(),
          userId,
          agentId,
          content,
          type,
          new Date()
        ]
      );
    } catch (error) {
      logger.error('Error logging message:', error);
    }
  }

  private async updateChangelog(
    userId: string,
    type: string,
    description: string,
    agentId?: string,
    goalId?: string
  ): Promise<void> {
    try {
      const db = getDatabase();
      await db.query(
        `INSERT INTO changelog_entries (id, user_id, type, title, description, agent_id, goal_id, impact, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          this.generateId(),
          userId,
          type,
          this.getChangelogTitle(type),
          description,
          agentId,
          goalId,
          'positive',
          new Date()
        ]
      );
    } catch (error) {
      logger.error('Error updating changelog:', error);
    }
  }

  private getAgentName(type: AgentType): string {
    const names = {
      'financial-advisor': 'Financial Advisor',
      'dietitian': 'Dietitian',
      'fitness-trainer': 'Fitness Trainer',
      'chore-manager': 'Chore Manager',
      'digital-wellness': 'Digital Wellness Coach'
    };
    return names[type] || 'Specialist Agent';
  }

  private getAgentDescription(type: AgentType): string {
    const descriptions = {
      'financial-advisor': 'Specializes in budgeting, saving, investing, and financial planning',
      'dietitian': 'Provides nutrition advice, meal planning, and dietary guidance',
      'fitness-trainer': 'Creates workout plans and provides fitness coaching',
      'chore-manager': 'Helps organize household tasks and improve efficiency',
      'digital-wellness': 'Manages screen time, digital habits, and online wellness'
    };
    return descriptions[type] || 'Specialist life coaching agent';
  }

  private getAgentCapabilities(type: AgentType): string[] {
    const capabilities = {
      'financial-advisor': ['budget-planning', 'expense-tracking', 'investment-advice', 'debt-management'],
      'dietitian': ['meal-planning', 'nutrition-analysis', 'recipe-recommendations', 'dietary-restrictions'],
      'fitness-trainer': ['workout-planning', 'exercise-demonstration', 'progress-tracking', 'injury-prevention'],
      'chore-manager': ['task-organization', 'scheduling', 'efficiency-tips', 'habit-formation'],
      'digital-wellness': ['screen-time-management', 'distraction-blocking', 'digital-habits', 'focus-training']
    };
    return capabilities[type] || [];
  }

  private getAgentSystemPrompt(type: AgentType): string {
    const prompts = {
      'financial-advisor': 'You are a Financial Advisor AI agent...',
      'dietitian': 'You are a Dietitian AI agent...',
      'fitness-trainer': 'You are a Fitness Trainer AI agent...',
      'chore-manager': 'You are a Chore Manager AI agent...',
      'digital-wellness': 'You are a Digital Wellness AI agent...'
    };
    return prompts[type] || 'You are a specialist AI agent...';
  }

  private getAgentTypeForGoal(category: string): AgentType {
    const mapping: Record<string, AgentType> = {
      'financial': 'financial-advisor',
      'health': 'fitness-trainer',
      'fitness': 'fitness-trainer',
      'nutrition': 'dietitian',
      'chores': 'chore-manager',
      'wellness': 'digital-wellness'
    };
    return mapping[category] || 'lead-coordinator';
  }

  private getChangelogTitle(type: string): string {
    const titles = {
      'goal_created': 'New Goal Created',
      'goal_completed': 'Goal Completed',
      'milestone_reached': 'Milestone Reached',
      'habit_formed': 'Habit Formed',
      'setback': 'Setback Experienced',
      'insight': 'New Insight',
      'recommendation': 'New Recommendation',
      'breakthrough': 'Breakthrough Achieved'
    };
    return titles[type] || 'Progress Update';
  }

  private determinePriority(responses: any[]): 'low' | 'medium' | 'high' {
    // Analyze responses to determine overall priority
    return 'medium';
  }

  // Location-based services methods
  async findNearbyPlaces(
    userId: string,
    latitude: number,
    longitude: number,
    radius: number,
    categories: string[]
  ): Promise<any> {
    try {
      return await this.locationServices.findNearbyPlaces(
        userId,
        latitude,
        longitude,
        radius,
        categories
      );
    } catch (error) {
      logger.error('Error finding nearby places:', error);
      throw error;
    }
  }

  async analyzeAreaSafety(
    userId: string,
    latitude: number,
    longitude: number,
    radius: number
  ): Promise<any> {
    try {
      return await this.locationServices.analyzeAreaSafety(
        userId,
        latitude,
        longitude,
        radius
      );
    } catch (error) {
      logger.error('Error analyzing area safety:', error);
      throw error;
    }
  }

  async planSafeRoute(
    userId: string,
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number },
    preferences: any
  ): Promise<any> {
    try {
      return await this.locationServices.planSafeRoute(
        userId,
        start,
        end,
        preferences
      );
    } catch (error) {
      logger.error('Error planning safe route:', error);
      throw error;
    }
  }

  async getLocationBasedRecommendations(
    userId: string,
    latitude: number,
    longitude: number,
    context: string
  ): Promise<any> {
    try {
      return await this.locationServices.getLocationBasedRecommendations(
        userId,
        latitude,
        longitude,
        context
      );
    } catch (error) {
      logger.error('Error getting location-based recommendations:', error);
      throw error;
    }
  }

  async checkLocationAlerts(
    userId: string,
    latitude: number,
    longitude: number,
    alertTypes: string[]
  ): Promise<any> {
    try {
      return await this.locationServices.checkLocationAlerts(
        userId,
        latitude,
        longitude,
        alertTypes
      );
    } catch (error) {
      logger.error('Error checking location alerts:', error);
      throw error;
    }
  }

  async updateLocationPreferences(userId: string, preferences: any): Promise<void> {
    try {
      const db = getDatabase();
      await db.query(
        `UPDATE user_preferences 
         SET location_preferences = $1, updated_at = NOW() 
         WHERE user_id = $2`,
        [JSON.stringify(preferences), userId]
      );
      
      logger.info(`Location preferences updated for user ${userId}`);
    } catch (error) {
      logger.error('Error updating location preferences:', error);
      throw error;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
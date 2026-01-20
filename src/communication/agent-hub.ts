import { Agent, AgentCommunication, AgentType } from '../types';
import { logger } from '../utils/logger';
import { getRedis } from '../config/redis';
import { LeadCoordinatorAgent } from '../agents/lead-coordinator';
import { FinancialAdvisorAgent } from '../agents/financial-advisor';
import { DietitianAgent } from '../agents/dietitian';
import { FitnessTrainerAgent } from '../agents/fitness-trainer';
import { ChoreManagerAgent } from '../agents/chore-manager';
import { DigitalWellnessAgent } from '../agents/digital-wellness';

export class AgentCommunicationHub {
  private agents: Map<string, Agent> = new Map();
  private agentInstances: Map<string, any> = new Map();
  private messageQueue: Map<string, any[]> = new Map();
  private redis = getRedis();

  async initialize(): Promise<void> {
    try {
      // Initialize all specialist agents
      await this.initializeAgents();
      
      // Start message processing
      this.startMessageProcessing();
      
      logger.info('Agent Communication Hub initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Agent Communication Hub:', error);
      throw error;
    }
  }

  async registerAgent(agent: Agent): Promise<void> {
    try {
      this.agents.set(agent.id, agent);
      this.messageQueue.set(agent.id, []);
      
      // Store in Redis for cross-process communication
      await this.redis.hSet('agents', agent.id, JSON.stringify(agent));
      
      logger.info(`Agent registered: ${agent.name} (${agent.id})`);
    } catch (error) {
      logger.error(`Failed to register agent ${agent.id}:`, error);
      throw error;
    }
  }

  async sendMessage(
    fromAgentId: string,
    toAgentId: string,
    message: any
  ): Promise<any> {
    try {
      const fromAgent = this.agents.get(fromAgentId);
      const toAgent = this.agents.get(toAgentId);

      if (!fromAgent || !toAgent) {
        throw new Error('Agent not found');
      }

      // Create communication record
      const communication: AgentCommunication = {
        id: this.generateId(),
        fromAgentId,
        toAgentId,
        message: JSON.stringify(message),
        context: message.context || {},
        timestamp: new Date()
      };

      // Store communication
      await this.storeCommunication(communication);

      // Get agent instance and process message
      const agentInstance = this.agentInstances.get(toAgentId);
      if (agentInstance) {
        const response = await this.processAgentMessage(
          toAgentId,
          agentInstance,
          message,
          communication
        );
        
        // Store response if any
        if (response) {
          communication.response = JSON.stringify(response);
          communication.respondedAt = new Date();
          await this.updateCommunication(communication);
        }
        
        return response;
      } else {
        // Queue message for later processing
        this.queueMessage(toAgentId, {
          ...message,
          fromAgentId,
          communicationId: communication.id
        });
        
        return {
          agentId: toAgentId,
          agentName: toAgent.name,
          type: 'queued',
          content: 'Message queued for processing',
          timestamp: new Date()
        };
      }

    } catch (error) {
      logger.error('Error sending agent message:', error);
      throw error;
    }
  }

  async broadcastMessage(
    fromAgentId: string,
    message: any,
    agentTypes?: AgentType[]
  ): Promise<any[]> {
    try {
      const responses: any[] = [];
      const targetAgents = agentTypes 
        ? Array.from(this.agents.values()).filter(agent => agentTypes.includes(agent.type))
        : Array.from(this.agents.values()).filter(agent => agent.id !== fromAgentId);

      for (const agent of targetAgents) {
        try {
          const response = await this.sendMessage(fromAgentId, agent.id, message);
          responses.push(response);
        } catch (error) {
          logger.error(`Failed to send broadcast to agent ${agent.id}:`, error);
        }
      }

      return responses;
    } catch (error) {
      logger.error('Error broadcasting message:', error);
      throw error;
    }
  }

  async coordinateAgentResponse(
    userId: string,
    agentIds: string[],
    message: any,
    context?: any
  ): Promise<any> {
    try {
      // Send message to all relevant agents
      const agentResponses = await Promise.all(
        agentIds.map(agentId => 
          this.sendMessage('lead-coordinator', agentId, {
            userId,
            message,
            context: { ...context, coordinationMode: true },
            type: 'coordination-request'
          })
        )
      );

      // Synthesize coordinated response
      const coordinatedResponse = await this.synthesizeAgentResponses(
        userId,
        agentResponses,
        message,
        context
      );

      return coordinatedResponse;
    } catch (error) {
      logger.error('Error coordinating agent response:', error);
      throw error;
    }
  }

  async getAgentStatus(agentId: string): Promise<any> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const queueSize = this.messageQueue.get(agentId)?.length || 0;
      const instance = this.agentInstances.get(agentId);
      
      return {
        agent,
        queueSize,
        status: agent.status,
        isActive: !!instance,
        lastActivity: await this.getLastAgentActivity(agentId),
        capabilities: agent.capabilities
      };
    } catch (error) {
      logger.error('Error getting agent status:', error);
      throw error;
    }
  }

  async getAllAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getActiveAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter(agent => agent.status === 'active');
  }

  async getAgentByType(type: AgentType): Promise<Agent | null> {
    const agents = Array.from(this.agents.values());
    return agents.find(agent => agent.type === type) || null;
  }

  private async initializeAgents(): Promise<void> {
    try {
      // Initialize lead coordinator
      const leadCoordinator = new LeadCoordinatorAgent(this);
      await leadCoordinator.initialize();
      this.agentInstances.set('lead-coordinator', leadCoordinator);

      // Initialize specialist agents
      const financialAdvisor = new FinancialAdvisorAgent();
      await financialAdvisor.initialize();
      this.agentInstances.set('financial-advisor', financialAdvisor);

      const dietitian = new DietitianAgent();
      await dietitian.initialize();
      this.agentInstances.set('dietitian', dietitian);

      const fitnessTrainer = new FitnessTrainerAgent();
      await fitnessTrainer.initialize();
      this.agentInstances.set('fitness-trainer', fitnessTrainer);

      const choreManager = new ChoreManagerAgent();
      await choreManager.initialize();
      this.agentInstances.set('chore-manager', choreManager);

      const digitalWellness = new DigitalWellnessAgent();
      await digitalWellness.initialize();
      this.agentInstances.set('digital-wellness', digitalWellness);

      logger.info('All specialist agents initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize agents:', error);
      throw error;
    }
  }

  private async processAgentMessage(
    agentId: string,
    agentInstance: any,
    message: any,
    communication: AgentCommunication
  ): Promise<any> {
    try {
      // Route message to appropriate agent method based on message type
      const response = await this.routeMessageToAgent(
        agentId,
        agentInstance,
        message
      );

      // Log successful processing
      await this.logMessageProcessing(communication.id, 'success');

      return response;
    } catch (error) {
      logger.error(`Error processing message for agent ${agentId}:`, error);
      await this.logMessageProcessing(communication.id, 'error', error.message);
      throw error;
    }
  }

  private async routeMessageToAgent(
    agentId: string,
    agentInstance: any,
    message: any
  ): Promise<any> {
    const { type, userId, data } = message;

    switch (agentId) {
      case 'financial-advisor':
        return await this.routeToFinancialAdvisor(agentInstance, message);
      
      case 'dietitian':
        return await this.routeToDietitian(agentInstance, message);
      
      case 'fitness-trainer':
        return await this.routeToFitnessTrainer(agentInstance, message);
      
      case 'chore-manager':
        return await this.routeToChoreManager(agentInstance, message);
      
      case 'digital-wellness':
        return await this.routeToDigitalWellness(agentInstance, message);
      
      default:
        throw new Error(`Unknown agent: ${agentId}`);
    }
  }

  private async routeToFinancialAdvisor(agent: FinancialAdvisorAgent, message: any): Promise<any> {
    switch (message.type) {
      case 'receipt-processing':
        return await agent.processReceipt(message.userId, message.imageData);
      
      case 'budget-creation':
        return await agent.createBudget(message.userId, message.income, message.expenses);
      
      case 'spending-analysis':
        return await agent.analyzeSpending(message.userId, message.period);
      
      case 'investment-advice':
        return await agent.provideInvestmentAdvice(message.userId, message.riskProfile, message.goals);
      
      case 'debt-management':
        return await agent.manageDebt(message.userId, message.debts);
      
      default:
        return { type: 'unknown-message', content: 'Message type not handled' };
    }
  }

  private async routeToDietitian(agent: DietitianAgent, message: any): Promise<any> {
    switch (message.type) {
      case 'meal-plan-creation':
        return await agent.createMealPlan(message.userId, message.preferences);
      
      case 'recipe-search':
        return await agent.searchRecipes(message.userId, message.query, message.filters);
      
      case 'nutrition-analysis':
        return await agent.analyzeNutrition(message.userId, message.meals);
      
      case 'grocery-optimization':
        return await agent.optimizeGroceryList(message.userId, message.items, message.budget);
      
      case 'nutritional-tracking':
        return await agent.trackNutritionalIntake(message.userId, message.date, message.meals);
      
      default:
        return { type: 'unknown-message', content: 'Message type not handled' };
    }
  }

  private async routeToFitnessTrainer(agent: FitnessTrainerAgent, message: any): Promise<any> {
    switch (message.type) {
      case 'workout-plan-creation':
        return await agent.createWorkoutPlan(message.userId, message.preferences);
      
      case 'workout-logging':
        return await agent.logWorkout(message.userId, message.workoutId, message.completedData);
      
      case 'fitness-assessment':
        return await agent.assessFitnessLevel(message.userId);
      
      case 'exercise-guidance':
        return await agent.provideExerciseGuidance(message.exerciseName, message.userLevel);
      
      case 'progress-tracking':
        return await agent.trackProgress(message.userId, message.period);
      
      default:
        return { type: 'unknown-message', content: 'Message type not handled' };
    }
  }

  private async routeToChoreManager(agent: ChoreManagerAgent, message: any): Promise<any> {
    switch (message.type) {
      case 'chore-plan-creation':
        return await agent.createChorePlan(message.userId, message.preferences);
      
      case 'task-addition':
        return await agent.addChoreTask(message.userId, message.taskData);
      
      case 'schedule-optimization':
        return await agent.optimizeChoreSchedule(message.userId, message.tasks);
      
      case 'progress-tracking':
        return await agent.trackChoreProgress(message.userId, message.period);
      
      case 'efficiency-tips':
        return await agent.provideEfficiencyTips(message.userId, message.category);
      
      default:
        return { type: 'unknown-message', content: 'Message type not handled' };
    }
  }

  private async routeToDigitalWellness(agent: DigitalWellnessAgent, message: any): Promise<any> {
    switch (message.type) {
      case 'habits-analysis':
        return await agent.analyzeDigitalHabits(message.userId, message.usageData);
      
      case 'focus-plan-creation':
        return await agent.createFocusPlan(message.userId, message.goals);
      
      case 'screen-time-management':
        return await agent.manageScreenTime(message.userId, message.limits);
      
      case 'addiction-support':
        return await agent.supportDigitalAddiction(message.userId, message.addictionType);
      
      case 'wellness-tracking':
        return await agent.trackWellnessProgress(message.userId, message.period);
      
      case 'mindfulness-break':
        return await agent.provideMindfulnessBreak(message.userId, message.breakType);
      
      default:
        return { type: 'unknown-message', content: 'Message type not handled' };
    }
  }

  private async synthesizeAgentResponses(
    userId: string,
    responses: any[],
    originalMessage: string,
    context?: any
  ): Promise<any> {
    try {
      // Filter out error responses
      const validResponses = responses.filter(response => !response.error);
      
      if (validResponses.length === 0) {
        return {
          type: 'error',
          content: 'No agents were able to process the request',
          timestamp: new Date()
        };
      }

      if (validResponses.length === 1) {
        return validResponses[0];
      }

      // Synthesize multiple agent responses
      const synthesis = {
        type: 'coordinated-response',
        agents: validResponses.map(r => r.agentId),
        content: this.synthesizeContent(validResponses),
        recommendations: this.extractRecommendations(validResponses),
        crossAgentInsights: this.extractCrossAgentInsights(validResponses),
        priority: this.determineOverallPriority(validResponses),
        nextSteps: this.generateNextSteps(validResponses),
        timestamp: new Date()
      };

      return synthesis;
    } catch (error) {
      logger.error('Error synthesizing agent responses:', error);
      return {
        type: 'error',
        content: 'Failed to synthesize agent responses',
        timestamp: new Date()
      };
    }
  }

  private synthesizeContent(responses: any[]): string {
    // Combine content from multiple agents
    const agentContents = responses.map(r => `${r.agentName}: ${r.content}`);
    return agentContents.join('\n\n');
  }

  private extractRecommendations(responses: any[]): any[] {
    const recommendations = [];
    
    for (const response of responses) {
      if (response.recommendations) {
        recommendations.push(...response.recommendations);
      }
    }
    
    return recommendations;
  }

  private extractCrossAgentInsights(responses: any[]): any[] {
    const insights = [];
    
    for (const response of responses) {
      if (response.crossAgentInsights) {
        insights.push(...response.crossAgentInsights);
      }
    }
    
    return insights;
  }

  private determineOverallPriority(responses: any[]): 'low' | 'medium' | 'high' {
    const priorities = responses.map(r => r.priority || 'medium');
    
    if (priorities.includes('high')) return 'high';
    if (priorities.includes('medium')) return 'medium';
    return 'low';
  }

  private generateNextSteps(responses: any[]): any[] {
    const nextSteps = [];
    
    for (const response of responses) {
      if (response.nextSteps) {
        nextSteps.push(...response.nextSteps);
      }
    }
    
    return nextSteps;
  }

  private queueMessage(agentId: string, message: any): void {
    const queue = this.messageQueue.get(agentId) || [];
    queue.push(message);
    this.messageQueue.set(agentId, queue);
  }

  private startMessageProcessing(): void {
    // Process messages for each agent
    setInterval(() => {
      this.processQueuedMessages();
    }, 1000); // Process every second
  }

  private async processQueuedMessages(): Promise<void> {
    for (const [agentId, queue] of this.messageQueue.entries()) {
      if (queue.length === 0) continue;

      const agent = this.agents.get(agentId);
      const agentInstance = this.agentInstances.get(agentId);
      
      if (!agent || !agentInstance || agent.status !== 'active') continue;

      // Process up to 5 messages per cycle
      const messagesToProcess = queue.splice(0, 5);
      
      for (const message of messagesToProcess) {
        try {
          await this.processAgentMessage(
            agentId,
            agentInstance,
            message,
            { id: message.communicationId } as AgentCommunication
          );
        } catch (error) {
          logger.error(`Error processing queued message for agent ${agentId}:`, error);
        }
      }
    }
  }

  private async storeCommunication(communication: AgentCommunication): Promise<void> {
    try {
      // Store in Redis for real-time access
      await this.redis.lPush(
        `communications:${communication.toAgentId}`,
        JSON.stringify(communication)
      );

      // Also store in persistent storage
      await this.redis.hSet(
        'communication_history',
        communication.id,
        JSON.stringify(communication)
      );

      // Set expiration for cleanup (30 days)
      await this.redis.expire(`communications:${communication.toAgentId}`, 2592000);
    } catch (error) {
      logger.error('Error storing communication:', error);
    }
  }

  private async updateCommunication(communication: AgentCommunication): Promise<void> {
    try {
      // Update in Redis
      await this.redis.hSet(
        'communication_history',
        communication.id,
        JSON.stringify(communication)
      );
    } catch (error) {
      logger.error('Error updating communication:', error);
    }
  }

  private async logMessageProcessing(
    communicationId: string,
    status: 'success' | 'error',
    error?: string
  ): Promise<void> {
    try {
      const logEntry = {
        communicationId,
        status,
        error,
        timestamp: new Date()
      };
      
      await this.redis.lPush(
        'communication_logs',
        JSON.stringify(logEntry)
      );
    } catch (error) {
      logger.error('Error logging message processing:', error);
    }
  }

  private async getLastAgentActivity(agentId: string): Promise<Date | null> {
    try {
      const lastCommunication = await this.redis.lIndex(
        `communications:${agentId}`,
        0
      );
      
      if (lastCommunication) {
        const communication = JSON.parse(lastCommunication);
        return new Date(communication.timestamp);
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting last agent activity:', error);
      return null;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
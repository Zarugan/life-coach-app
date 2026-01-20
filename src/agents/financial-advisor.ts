import { Agent, User, Receipt, Goal, ProgressEntry } from '../types';
import { logger } from '../utils/logger';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import Tesseract from 'tesseract.js';
import axios from 'axios';

export class FinancialAdvisorAgent {
  private agent: Agent;
  private openai: any; // OpenAI client

  constructor() {
    this.agent = {
      id: 'financial-advisor',
      type: 'financial-advisor',
      name: 'Financial Advisor',
      description: 'Specializes in budgeting, saving, investing, and financial planning',
      capabilities: [
        'budget-planning',
        'expense-tracking',
        'investment-advice',
        'debt-management',
        'receipt-scanning',
        'spending-analysis',
        'financial-goal-setting',
        'savings-recommendations'
      ],
      status: 'active',
      config: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: `You are a Financial Advisor AI agent specializing in personal finance management. 
        Your role is to:
        1. Analyze spending patterns and provide budget recommendations
        2. Process receipts and track expenses automatically
        3. Create personalized savings and investment plans
        4. Provide debt management strategies
        5. Offer financial education and guidance
        6. Coordinate with other agents (like Dietitian for grocery cost optimization)
        
        Always provide practical, actionable advice tailored to the user's financial situation.
        Be encouraging but realistic about financial goals. Maintain strict confidentiality of financial data.`,
        tools: []
      }
    };
  }

  async initialize(): Promise<void> {
    try {
      // Initialize OpenAI client
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      logger.info('Financial Advisor Agent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Financial Advisor Agent:', error);
      throw error;
    }
  }

  async processReceipt(userId: string, imageData: string): Promise<any> {
    try {
      logger.info(`Processing receipt for user ${userId}`);

      // Step 1: OCR to extract text from receipt
      const extractedText = await this.extractTextFromImage(imageData);
      
      // Step 2: Parse receipt information using AI
      const receiptData = await this.parseReceiptWithAI(extractedText);
      
      // Step 3: Store receipt in database
      const receipt = await this.storeReceipt(userId, receiptData, imageData);
      
      // Step 4: Analyze spending and update budget
      await this.analyzeSpending(userId, receipt);
      
      // Step 5: Check for cross-agent opportunities
      const crossAgentInsights = await this.getCrossAgentInsights(receipt);
      
      return {
        success: true,
        receipt,
        insights: crossAgentInsights,
        budgetImpact: await this.calculateBudgetImpact(userId, receipt),
        recommendations: await this.generateSpendingRecommendations(userId, receipt)
      };

    } catch (error) {
      logger.error('Error processing receipt:', error);
      throw error;
    }
  }

  async createBudget(userId: string, income: number, expenses: any[]): Promise<any> {
    try {
      // Analyze current spending patterns
      const spendingAnalysis = await this.analyzeSpendingPatterns(userId);
      
      // Create AI-powered budget recommendations
      const budgetRecommendations = await this.generateBudgetRecommendations(
        userId,
        income,
        expenses,
        spendingAnalysis
      );
      
      // Store budget
      const budget = await this.storeBudget(userId, budgetRecommendations);
      
      return {
        success: true,
        budget,
        recommendations: budgetRecommendations,
        monthlyProjection: await this.projectMonthlySpending(userId, budget),
        savingsOpportunities: await this.identifySavingsOpportunities(userId, budget)
      };

    } catch (error) {
      logger.error('Error creating budget:', error);
      throw error;
    }
  }

  async analyzeSpending(userId: string, period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<any> {
    try {
      const db = getDatabase();
      
      // Get spending data for the period
      const spendingQuery = `
        SELECT 
          DATE_TRUNC('${period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'}', r.date) as period,
          r.category,
          SUM(r.amount) as total_amount,
          COUNT(*) as transaction_count,
          AVG(r.amount) as avg_transaction
        FROM receipts r
        WHERE r.user_id = $1 
          AND r.date >= NOW() - INTERVAL '1 ${period === 'daily' ? 'month' : period === 'weekly' ? 'month' : 'year'}'
        GROUP BY period, r.category
        ORDER BY period DESC, total_amount DESC
      `;
      
      const result = await db.query(spendingQuery, [userId]);
      
      // Generate AI analysis
      const analysis = await this.generateSpendingAnalysis(result.rows, period);
      
      return {
        period,
        spendingData: result.rows,
        analysis,
        trends: await this.identifySpendingTrends(userId, period),
        budgetComparison: await this.compareWithBudget(userId, result.rows),
        recommendations: await this.generateSpendingRecommendations(userId, null, result.rows)
      };

    } catch (error) {
      logger.error('Error analyzing spending:', error);
      throw error;
    }
  }

  async provideInvestmentAdvice(userId: string, riskProfile: string, goals: any[]): Promise<any> {
    try {
      // Get user's financial situation
      const financialProfile = await this.getUserFinancialProfile(userId);
      
      // Generate investment recommendations using AI
      const investmentAdvice = await this.generateInvestmentAdvice(
        financialProfile,
        riskProfile,
        goals
      );
      
      return {
        success: true,
        riskProfile,
        advice: investmentAdvice,
        portfolioRecommendations: investmentAdvice.portfolio,
        expectedReturns: investmentAdvice.returns,
        riskAssessment: investmentAdvice.risks,
        nextSteps: investmentAdvice.actionItems
      };

    } catch (error) {
      logger.error('Error providing investment advice:', error);
      throw error;
    }
  }

  async manageDebt(userId: string, debts: any[]): Promise<any> {
    try {
      // Analyze debt situation
      const debtAnalysis = await this.analyzeDebtSituation(debts);
      
      // Generate debt payoff strategies
      const payoffStrategies = await this.generateDebtPayoffStrategies(
        userId,
        debts,
        debtAnalysis
      );
      
      return {
        success: true,
        totalDebt: debtAnalysis.totalDebt,
        monthlyPayment: debtAnalysis.totalMonthlyPayment,
        strategies: payoffStrategies,
        recommendedStrategy: payoffStrategies[0],
        timeline: debtAnalysis.payoffTimeline,
        savingsPotential: debtAnalysis.savingsPotential
      };

    } catch (error) {
      logger.error('Error managing debt:', error);
      throw error;
    }
  }

  private async extractTextFromImage(imageData: string): Promise<string> {
    try {
      const worker = await Tesseract.createWorker('eng');
      const { data: { text } } = await worker.recognize(imageData);
      await worker.terminate();
      return text;
    } catch (error) {
      logger.error('Error extracting text from image:', error);
      throw error;
    }
  }

  private async parseReceiptWithAI(extractedText: string): Promise<any> {
    try {
      const prompt = `
        Parse this receipt text and extract structured information:
        
        Text: ${extractedText}
        
        Return JSON with:
        - merchant: Store/restaurant name
        - date: Purchase date
        - total: Total amount
        - currency: Currency type
        - category: Purchase category
        - items: Array of items with name, quantity, unitPrice, totalPrice
        - tax: Tax amount if visible
        - paymentMethod: Payment method if visible
        
        Only return valid JSON, no explanations.
      `;

      const response = await this.openai.chat.completions.create({
        model: this.agent.config.model,
        messages: [
          { role: 'system', content: 'You are a receipt parsing expert. Extract structured data from receipt text.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        maxTokens: 1000
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error parsing receipt with AI:', error);
      throw error;
    }
  }

  private async storeReceipt(userId: string, receiptData: any, imageData: string): Promise<Receipt> {
    try {
      const db = getDatabase();
      
      const receipt: Receipt = {
        id: this.generateId(),
        userId,
        merchant: receiptData.merchant || 'Unknown',
        amount: receiptData.total || 0,
        currency: receiptData.currency || 'USD',
        category: receiptData.category || 'Uncategorized',
        date: new Date(receiptData.date || Date.now()),
        items: receiptData.items || [],
        imageUrl: imageData, // In production, store in cloud storage
        processedAt: new Date()
      };

      await db.query(
        `INSERT INTO receipts (id, user_id, merchant, amount, currency, category, date, items, image_url, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          receipt.id,
          receipt.userId,
          receipt.merchant,
          receipt.amount,
          receipt.currency,
          receipt.category,
          receipt.date,
          JSON.stringify(receipt.items),
          receipt.imageUrl,
          receipt.processedAt
        ]
      );

      return receipt;
    } catch (error) {
      logger.error('Error storing receipt:', error);
      throw error;
    }
  }

  private async analyzeSpending(userId: string, receipt: Receipt): Promise<void> {
    try {
      // Update category spending
      await this.updateCategorySpending(userId, receipt);
      
      // Check budget alerts
      await this.checkBudgetAlerts(userId, receipt);
      
      // Update financial goals progress
      await this.updateFinancialGoals(userId, receipt);
    } catch (error) {
      logger.error('Error analyzing spending:', error);
    }
  }

  private async getCrossAgentInsights(receipt: Receipt): Promise<any> {
    const insights = [];

    // Grocery-related insights for Dietitian
    if (receipt.category === 'Groceries' || receipt.merchant.includes('supermarket')) {
      insights.push({
        agent: 'dietitian',
        type: 'nutrition-opportunity',
        message: 'Grocery purchase detected. Can analyze for nutritional optimization and meal planning.',
        data: {
          items: receipt.items,
          totalSpent: receipt.amount,
          merchant: receipt.merchant
        }
      });
    }

    // Gym/Fitness related insights
    if (receipt.category === 'Fitness' || receipt.merchant.includes('gym')) {
      insights.push({
        agent: 'fitness-trainer',
        type: 'fitness-investment',
        message: 'Fitness expense detected. Can optimize workout plan for membership value.',
        data: {
          amount: receipt.amount,
          merchant: receipt.merchant
        }
      });
    }

    return insights;
  }

  private async generateBudgetRecommendations(
    userId: string,
    income: number,
    expenses: any[],
    spendingAnalysis: any
  ): Promise<any> {
    try {
      const prompt = `
        Create a comprehensive budget plan based on:
        - Monthly Income: $${income}
        - Current Expenses: ${JSON.stringify(expenses)}
        - Spending Analysis: ${JSON.stringify(spendingAnalysis)}
        
        Provide recommendations using the 50/30/20 rule (50% needs, 30% wants, 20% savings) as a baseline,
        but adjust based on the user's actual spending patterns.
        
        Return JSON with:
        - needs: Budget for essential expenses (rent, utilities, groceries, etc.)
        - wants: Budget for discretionary spending (entertainment, dining out, etc.)
        - savings: Budget for savings and investments
        - recommendations: Specific advice for reducing expenses
        - goals: Suggested financial goals
        
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: this.agent.config.model,
        messages: [
          { role: 'system', content: 'You are a certified financial planner. Create realistic, actionable budget recommendations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 1500
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating budget recommendations:', error);
      throw error;
    }
  }

  private async generateSpendingAnalysis(spendingData: any[], period: string): Promise<any> {
    try {
      const prompt = `
        Analyze this spending data for the ${period} period:
        ${JSON.stringify(spendingData)}
        
        Provide insights on:
        - Spending patterns and trends
        - Unusual expenses or outliers
        - Areas for potential savings
        - Budget adherence
        - Financial health indicators
        
        Return JSON with analysis, insights, and recommendations.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: this.agent.config.model,
        messages: [
          { role: 'system', content: 'You are a financial analyst. Provide detailed spending analysis and insights.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 1500
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating spending analysis:', error);
      throw error;
    }
  }

  private async getUserFinancialProfile(userId: string): Promise<any> {
    try {
      const db = getDatabase();
      
      // Get recent financial data
      const receiptsQuery = `
        SELECT category, SUM(amount) as total, COUNT(*) as count
        FROM receipts 
        WHERE user_id = $1 AND date >= NOW() - INTERVAL '3 months'
        GROUP BY category
      `;
      
      const goalsQuery = `
        SELECT * FROM goals 
        WHERE user_id = $1 AND category = 'financial'
      `;
      
      const [receiptsResult, goalsResult] = await Promise.all([
        db.query(receiptsQuery, [userId]),
        db.query(goalsQuery, [userId])
      ]);

      return {
        spendingByCategory: receiptsResult.rows,
        financialGoals: goalsResult.rows,
        totalSpent: receiptsResult.rows.reduce((sum, row) => sum + parseFloat(row.total), 0)
      };
    } catch (error) {
      logger.error('Error getting user financial profile:', error);
      return {};
    }
  }

  private async generateInvestmentAdvice(
    financialProfile: any,
    riskProfile: string,
    goals: any[]
  ): Promise<any> {
    try {
      const prompt = `
        Provide investment advice based on:
        - Financial Profile: ${JSON.stringify(financialProfile)}
        - Risk Profile: ${riskProfile}
        - Goals: ${JSON.stringify(goals)}
        
        Create a diversified investment portfolio recommendation with:
        - Asset allocation (stocks, bonds, real estate, etc.)
        - Specific investment suggestions
        - Risk assessment
        - Expected returns
        - Action items
        
        Return JSON with comprehensive investment advice.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: this.agent.config.model,
        messages: [
          { role: 'system', content: 'You are a certified investment advisor. Provide prudent, diversified investment recommendations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        maxTokens: 2000
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating investment advice:', error);
      throw error;
    }
  }

  private async analyzeDebtSituation(debts: any[]): Promise<any> {
    const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0);
    const totalMonthlyPayment = debts.reduce((sum, debt) => sum + debt.monthlyPayment, 0);
    
    // Calculate payoff timelines using different strategies
    const avalancheTimeline = this.calculateAvalancheTimeline(debts);
    const snowballTimeline = this.calculateSnowballTimeline(debts);
    
    return {
      totalDebt,
      totalMonthlyPayment,
      avalancheTimeline,
      snowballTimeline,
      savingsPotential: Math.max(0, snowballTimeline.totalInterest - avalancheTimeline.totalInterest)
    };
  }

  private async generateDebtPayoffStrategies(
    userId: string,
    debts: any[],
    analysis: any
  ): Promise<any[]> {
    return [
      {
        name: 'Avalanche Method',
        description: 'Pay off high-interest debt first',
        timeline: analysis.avalancheTimeline,
        totalInterest: analysis.avalancheTimeline.totalInterest,
        pros: ['Saves most money on interest', 'Mathematically optimal'],
        cons: ['May take longer to see progress', 'Requires discipline']
      },
      {
        name: 'Snowball Method',
        description: 'Pay off smallest debts first for momentum',
        timeline: analysis.snowballTimeline,
        totalInterest: analysis.snowballTimeline.totalInterest,
        pros: ['Quick wins build momentum', 'Psychologically rewarding'],
        cons: ['Costs more in interest', 'Not mathematically optimal']
      }
    ];
  }

  private calculateAvalancheTimeline(debts: any[]): any {
    // Sort by interest rate (highest first)
    const sortedDebts = [...debts].sort((a, b) => b.interestRate - a.interestRate);
    return this.calculatePayoffTimeline(sortedDebts);
  }

  private calculateSnowballTimeline(debts: any[]): any {
    // Sort by amount (smallest first)
    const sortedDebts = [...debts].sort((a, b) => a.amount - b.amount);
    return this.calculatePayoffTimeline(sortedDebts);
  }

  private calculatePayoffTimeline(debts: any[]): any {
    // Simplified calculation - in production, would be more sophisticated
    let totalInterest = 0;
    let months = 0;
    
    for (const debt of debts) {
      const interest = debt.amount * (debt.interestRate / 100) * (debt.amount / debt.monthlyPayment / 12);
      totalInterest += interest;
      months += Math.ceil(debt.amount / debt.monthlyPayment);
    }
    
    return {
      totalInterest,
      months,
      totalPayment: debts.reduce((sum, debt) => sum + debt.amount, 0) + totalInterest
    };
  }

  private async updateCategorySpending(userId: string, receipt: Receipt): Promise<void> {
    try {
      const redis = getRedis();
      const key = `spending:${userId}:${receipt.category}:${new Date().getMonth()}`;
      
      // Update category spending in Redis
      const current = await redis.get(key) || '0';
      const newTotal = parseFloat(current) + receipt.amount;
      await redis.set(key, newTotal.toString());
      
      // Set expiration for end of month
      await redis.expire(key, 2592000); // 30 days
    } catch (error) {
      logger.error('Error updating category spending:', error);
    }
  }

  private async checkBudgetAlerts(userId: string, receipt: Receipt): Promise<void> {
    try {
      // Check if spending exceeds budget for category
      // Implementation would query user's budget and compare
    } catch (error) {
      logger.error('Error checking budget alerts:', error);
    }
  }

  private async updateFinancialGoals(userId: string, receipt: Receipt): Promise<void> {
    try {
      // Update progress towards financial goals
      // Implementation would update goal progress based on spending
    } catch (error) {
      logger.error('Error updating financial goals:', error);
    }
  }

  private async calculateBudgetImpact(userId: string, receipt: Receipt): Promise<any> {
    try {
      // Calculate how this receipt affects the user's budget
      return {
        category: receipt.category,
        amount: receipt.amount,
        budgetRemaining: 0, // Would calculate from budget
        impact: 'neutral' // 'under', 'over', 'neutral'
      };
    } catch (error) {
      logger.error('Error calculating budget impact:', error);
      return {};
    }
  }

  private async generateSpendingRecommendations(
    userId: string,
    receipt?: Receipt | null,
    spendingData?: any[]
  ): Promise<any[]> {
    try {
      const recommendations = [];
      
      if (receipt) {
        // Receipt-specific recommendations
        if (receipt.amount > 100) {
          recommendations.push({
            type: 'large-expense',
            message: `Large expense detected at ${receipt.merchant}. Consider if this was planned.`,
            priority: 'medium'
          });
        }
      }
      
      if (spendingData) {
        // General spending recommendations
        recommendations.push({
          type: 'spending-pattern',
          message: 'Based on your spending patterns, consider setting a stricter budget for entertainment.',
          priority: 'low'
        });
      }
      
      return recommendations;
    } catch (error) {
      logger.error('Error generating spending recommendations:', error);
      return [];
    }
  }

  private async identifySpendingTrends(userId: string, period: string): Promise<any> {
    try {
      // Analyze spending trends over time
      return {
        increasingCategories: [],
        decreasingCategories: [],
        seasonalPatterns: [],
        anomalies: []
      };
    } catch (error) {
      logger.error('Error identifying spending trends:', error);
      return {};
    }
  }

  private async compareWithBudget(userId: string, spendingData: any[]): Promise<any> {
    try {
      // Compare actual spending with budget
      return {
        onTrack: [],
        overBudget: [],
        underBudget: [],
        totalVariance: 0
      };
    } catch (error) {
      logger.error('Error comparing with budget:', error);
      return {};
    }
  }

  private async projectMonthlySpending(userId: string, budget: any): Promise<any> {
    try {
      // Project monthly spending based on budget and patterns
      return {
        projectedTotal: 0,
        categoryProjections: {},
        confidence: 'medium'
      };
    } catch (error) {
      logger.error('Error projecting monthly spending:', error);
      return {};
    }
  }

  private async identifySavingsOpportunities(userId: string, budget: any): Promise<any[]> {
    try {
      return [
        {
          category: 'Dining Out',
          potentialSavings: 50,
          description: 'Reduce dining out by 2 meals per week',
          difficulty: 'easy'
        }
      ];
    } catch (error) {
      logger.error('Error identifying savings opportunities:', error);
      return [];
    }
  }

  private async storeBudget(userId: string, budget: any): Promise<any> {
    try {
      const db = getDatabase();
      const budgetId = this.generateId();
      
      await db.query(
        `INSERT INTO budgets (id, user_id, income, needs, wants, savings, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          budgetId,
          userId,
          budget.income || 0,
          JSON.stringify(budget.needs || {}),
          JSON.stringify(budget.wants || {}),
          JSON.stringify(budget.savings || {})
        ]
      );

      return { id: budgetId, ...budget };
    } catch (error) {
      logger.error('Error storing budget:', error);
      throw error;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
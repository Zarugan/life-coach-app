import { createWorker, Worker } from 'tesseract.js';
import { logger } from '../utils/logger';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import { Receipt, ReceiptItem } from '../types';

export class ReceiptScanningService {
  private openai: any;
  private workerQueue: Map<string, Worker> = new Map();
  private scanQueue: any[] = [];
  private processing = false;

  constructor() {
    this.initializeOpenAI();
    this.startQueueProcessing();
  }

  private async initializeOpenAI(): Promise<void> {
    try {
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      logger.info('OpenAI initialized for receipt scanning');
    } catch (error) {
      logger.error('Failed to initialize OpenAI for receipt scanning:', error);
    }
  }

  async processReceiptUpload(
    userId: string,
    imageData: string,
    options: any = {}
  ): Promise<any> {
    try {
      logger.info(`Processing receipt upload for user ${userId}`);

      // Add to queue
      const scanJob = {
        id: this.generateId(),
        userId,
        imageData,
        options,
        status: 'queued',
        createdAt: new Date()
      };

      this.scanQueue.push(scanJob);
      
      // Process immediately if not busy
      if (!this.processing) {
        await this.processNextInQueue();
      }

      return {
        success: true,
        jobId: scanJob.id,
        message: 'Receipt added to processing queue',
        estimatedTime: this.estimateProcessingTime(imageData)
      };

    } catch (error) {
      logger.error('Error processing receipt upload:', error);
      throw error;
    }
  }

  async processImageWithOCR(imageData: string): Promise<any> {
    try {
      logger.info('Starting OCR processing');

      // Create Tesseract worker
      const worker = await createWorker('eng', 1, {
        logger: (m) => logger.info(`Tesseract: ${m}`),
        errorHandler: (e) => logger.error(`Tesseract error: ${e}`)
      });

      try {
        // Perform OCR
        const { data: { text, confidence } } = await worker.recognize(imageData, {
          tessedit_ocr_engine_mode: '3', // Neural nets LSTM
          tessedit_pageseg_mode: '6', // Single uniform block
          preserve_interword_spaces: '1',
          tessedit_char_whitelist: '0123456789.$ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz%,-: '
        });

        return {
          text: text.trim(),
          confidence,
          processingTime: Date.now()
        };

      } finally {
        // Clean up worker
        await worker.terminate();
      }

    } catch (error) {
      logger.error('OCR processing failed:', error);
      throw error;
    }
  }

  async parseReceiptWithAI(ocrText: string, imageMetadata?: any): Promise<any> {
    try {
      if (!this.openai) {
        return await this.parseWithBasicRules(ocrText);
      }

      const prompt = `
        Parse this receipt text and extract structured information:
        
        Receipt Text: ${ocrText}
        Image Metadata: ${JSON.stringify(imageMetadata || {})}
        
        Extract and return ONLY valid JSON with:
        {
          "merchant": "Store/restaurant name",
          "date": "YYYY-MM-DD format",
          "total": 123.45,
          "currency": "USD",
          "subtotal": 123.45,
          "tax": 12.34,
          "tip": 15.67,
          "paymentMethod": "cash/card/mobile",
          "category": "groceries/dining/retail/etc",
          "items": [
            {
              "name": "Item name",
              "quantity": 2,
              "unitPrice": 5.99,
              "totalPrice": 11.98,
              "category": "produce/dairy/etc",
              "discount": 0.50,
              "sku": "123456",
              "weight": "1.5 lbs"
            }
          ],
          "confidence": 0.95,
          "receiptType": "itemized/summary",
          "notes": "Additional observations",
          "loyaltyInfo": {
            "program": "Store Rewards",
            "pointsEarned": 50,
            "balance": 1250
          }
        }
        
        Rules:
        - Look for store names at top of receipt
        - Find total amount (look for TOTAL, SUBTOTAL, etc.)
        - Extract date/time information
        - Parse individual items with quantities and prices
        - Identify payment method from text
        - Categorize based on merchant type and items
        - Handle multiple currencies appropriately
        - Extract loyalty program info if present
        
        If confidence is low (<70%), indicate uncertainty.
        If receipt is damaged/unreadable, set confidence < 0.5.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert receipt parser. Extract accurate, complete information from receipts of all types. Handle smudged text, multiple formats, and edge cases gracefully.' 
          },
          { 
            role: 'user', 
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: imageMetadata?.imageUrl || null
              }
            ]
          }
        ],
        temperature: 0.1,
        maxTokens: 2000,
        response_format: { type: "json_object" }
      });

      const parsedData = JSON.parse(response.choices[0].message.content);
      
      // Validate and enhance parsed data
      return await this.validateAndEnhanceParsedData(parsedData, ocrText);

    } catch (error) {
      logger.error('AI receipt parsing failed:', error);
      // Fallback to basic parsing
      return await this.parseWithBasicRules(ocrText);
    }
  }

  async analyzeSpendingPatterns(userId: string, receipts: any[]): Promise<any> {
    try {
      // Get user's spending history
      const spendingHistory = await this.getUserSpendingHistory(userId, 30); // Last 30 days
      
      // Analyze current receipt in context
      const currentReceipt = receipts[receipts.length - 1];
      const categoryAnalysis = await this.analyzeCategorySpending(userId, currentReceipt.category);
      
      // Generate AI-powered spending insights
      const insights = await this.generateSpendingInsights(
        currentReceipt,
        categoryAnalysis,
        spendingHistory
      );
      
      // Budget impact analysis
      const budgetImpact = await this.analyzeBudgetImpact(userId, currentReceipt);
      
      // Cross-agent recommendations
      const crossAgentInsights = await this.getCrossAgentSpendingInsights(currentReceipt);

      return {
        receiptAnalysis: {
          ...currentReceipt,
          insights,
          categoryRanking: this.calculateCategoryRanking(categoryAnalysis, currentReceipt),
          spendingTrend: this.calculateSpendingTrend(spendingHistory, currentReceipt)
        },
        budgetImpact,
        crossAgentInsights,
        recommendations: await this.generateSpendingRecommendations(
          userId,
          currentReceipt,
          budgetImpact
        ),
        relatedDeals: await this.findRelatedDeals(currentReceipt)
      };

    } catch (error) {
      logger.error('Error analyzing spending patterns:', error);
      throw error;
    }
  }

  async enhanceReceiptWithMetadata(receiptData: any, imageData: string): Promise<any> {
    try {
      // Add image quality metrics
      const imageMetrics = await this.analyzeImageQuality(imageData);
      
      // Add location context if available
      const locationContext = await this.getLocationContext();
      
      // Add time context
      const timeContext = this.getTimeContext();
      
      // Add seasonality analysis
      const seasonality = this.analyzeSeasonality(receiptData);

      return {
        ...receiptData,
        metadata: {
          imageQuality: imageMetrics,
          location: locationContext,
          time: timeContext,
          seasonality,
          processingTimestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Error enhancing receipt with metadata:', error);
      return receiptData;
    }
  }

  async validateAndEnhanceParsedData(parsedData: any, ocrText: string): Promise<any> {
    try {
      // Validate required fields
      const validation = {
        hasMerchant: !!parsedData.merchant,
        hasTotal: !!parsedData.total,
        hasDate: !!parsedData.date,
        hasItems: Array.isArray(parsedData.items) && parsedData.items.length > 0,
        confidence: parsedData.confidence || 0.5
      };

      // Auto-correct common issues
      const corrections = await this.autoCorrectReceiptData(parsedData, ocrText);
      
      // Add missing information
      const enhanced = await this.addMissingInformation(parsedData, ocrText);

      return {
        ...parsedData,
        ...enhanced,
        validation,
        corrections,
        processedAt: new Date()
      };

    } catch (error) {
      logger.error('Error validating receipt data:', error);
      return parsedData;
    }
  }

  private async parseWithBasicRules(ocrText: string): Promise<any> {
    try {
      const lines = ocrText.split('\n').filter(line => line.trim());
      
      // Basic extraction using regex patterns
      const merchant = this.extractMerchant(lines);
      const date = this.extractDate(lines);
      const total = this.extractTotal(lines);
      const items = this.extractItems(lines);
      const category = this.guessCategory(merchant, items);

      return {
        merchant,
        date,
        total,
        currency: 'USD',
        category,
        items,
        confidence: 0.7,
        receiptType: 'basic_parsing'
      };

    } catch (error) {
      logger.error('Basic receipt parsing failed:', error);
      return {
        merchant: 'Unknown',
        date: new Date().toISOString().split('T')[0],
        total: 0,
        currency: 'USD',
        category: 'uncategorized',
        items: [],
        confidence: 0.3,
        receiptType: 'parsing_failed'
      };
    }
  }

  private extractMerchant(lines: string[]): string {
    // Look for common merchant indicators
    const merchantPatterns = [
      /^(WALMART|TARGET|COSTCO|KROGER|SAFEWAY|WHOLE FOODS)/i,
      /^(STARBUCKS|MCDONALD'S|SUBWAY|CHIPOTLE)/i,
      /^(AMAZON|EBAY|BEST BUY)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/  // Capitalized words
    ];

    for (const line of lines) {
      for (const pattern of merchantPatterns) {
        const match = line.match(pattern);
        if (match) return match[0];
      }
    }

    // Default to first non-empty line
    return lines.find(line => line.trim().length > 0) || 'Unknown Merchant';
  }

  private extractDate(lines: string[]): string {
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{2,4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          const date = new Date(match[0]);
          return date.toISOString().split('T')[0];
        }
      }
    }

    return new Date().toISOString().split('T')[0];
  }

  private extractTotal(lines: string[]): number {
    const totalPatterns = [
      /TOTAL[:\s]*\$?([\d,]+\.\d{2})/i,
      /SUBTOTAL[:\s]*\$?([\d,]+\.\d{2})/i,
      /AMOUNT[:\s]*\$?([\d,]+\.\d{2})/i,
      /\$?([\d,]+\.\d{2})\s*(TOTAL|AMOUNT)/i
    ];

    let lastValidTotal = 0;

    for (const line of lines) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          const total = parseFloat(match[1].replace(',', ''));
          if (!isNaN(total)) {
            lastValidTotal = total;
          }
        }
      }
    }

    return lastValidTotal;
  }

  private extractItems(lines: string[]): any[] {
    const items = [];
    let currentItem = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for price patterns (items usually have prices)
      const priceMatch = line.match(/\$?([\d,]+\.\d{2})/);
      
      if (priceMatch && !/TOTAL|SUBTOTAL|TAX/i.test(line)) {
        const price = parseFloat(priceMatch[1].replace(',', ''));
        const itemText = line.replace(priceMatch[0], '').trim();
        
        if (itemText && price > 0) {
          currentItem = {
            name: itemText,
            totalPrice: price,
            unitPrice: price, // Will be refined with quantity
            quantity: 1,
            category: this.guessItemCategory(itemText)
          };
          
          items.push(currentItem);
        }
      }
    }

    return items;
  }

  private guessCategory(merchant: string, items: any[]): string {
    // Categorize based on merchant name and items
    const merchantLower = merchant.toLowerCase();
    
    if (merchantLower.includes('walmart') || merchantLower.includes('target') || 
        merchantLower.includes('kroger') || merchantLower.includes('safeway')) {
      return 'groceries';
    }
    
    if (merchantLower.includes('mcdonald') || merchantLower.includes('subway') || 
        merchantLower.includes('chipotle')) {
      return 'dining';
    }
    
    if (merchantLower.includes('starbucks') || merchantLower.includes('dunkin')) {
      return 'coffee';
    }
    
    if (merchantLower.includes('gas') || merchantLower.includes('shell') || 
        merchantLower.includes('chevron')) {
      return 'gas';
    }
    
    // Analyze items if merchant is unknown
    const hasGroceryItems = items.some(item => 
      item.category === 'produce' || item.category === 'dairy' || item.category === 'bakery'
    );
    
    if (hasGroceryItems) return 'groceries';
    if (items.some(item => item.category === 'electronics')) return 'retail';
    
    return 'uncategorized';
  }

  private guessItemCategory(itemText: string): string {
    const text = itemText.toLowerCase();
    
    if (text.includes('apple') || text.includes('banana') || text.includes('orange') || 
        text.includes('lettuce') || text.includes('tomato')) {
      return 'produce';
    }
    
    if (text.includes('milk') || text.includes('cheese') || text.includes('yogurt')) {
      return 'dairy';
    }
    
    if (text.includes('bread') || text.includes('bagel') || text.includes('croissant')) {
      return 'bakery';
    }
    
    if (text.includes('chicken') || text.includes('beef') || text.includes('pork')) {
      return 'meat';
    }
    
    return 'other';
  }

  private async getUserSpendingHistory(userId: string, days: number): Promise<any[]> {
    try {
      const db = getDatabase();
      const result = await db.query(
        `SELECT * FROM receipts 
         WHERE user_id = $1 
         AND date >= NOW() - INTERVAL '${days} days'
         ORDER BY date DESC`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting user spending history:', error);
      return [];
    }
  }

  private async analyzeCategorySpending(userId: string, category: string): Promise<any> {
    try {
      const db = getDatabase();
      const result = await db.query(
        `SELECT 
           COUNT(*) as transaction_count,
           SUM(amount) as total_spent,
           AVG(amount) as average_transaction,
           MAX(amount) as max_transaction,
           MIN(amount) as min_transaction
         FROM receipts 
         WHERE user_id = $1 AND category = $2 
         AND date >= NOW() - INTERVAL '30 days'`,
        [userId, category]
      );

      const categoryData = result.rows[0] || {};
      
      return {
        category,
        transactionCount: parseInt(categoryData.transaction_count) || 0,
        totalSpent: parseFloat(categoryData.total_spent) || 0,
        averageTransaction: parseFloat(categoryData.average_transaction) || 0,
        maxTransaction: parseFloat(categoryData.max_transaction) || 0,
        minTransaction: parseFloat(categoryData.min_transaction) || 0,
        frequency: this.calculateFrequency(categoryData.transaction_count)
      };

    } catch (error) {
      logger.error('Error analyzing category spending:', error);
      return {};
    }
  }

  private calculateFrequency(transactionCount: number): string {
    if (transactionCount === 0) return 'none';
    if (transactionCount <= 4) return 'low';
    if (transactionCount <= 10) return 'medium';
    return 'high';
  }

  private async generateSpendingInsights(
    currentReceipt: any,
    categoryAnalysis: any,
    spendingHistory: any[]
  ): Promise<any[]> {
    try {
      if (!this.openai) {
        return this.generateBasicInsights(currentReceipt, categoryAnalysis);
      }

      const prompt = `
        Analyze this receipt and provide spending insights:
        
        Current Receipt: ${JSON.stringify(currentReceipt)}
        Category Analysis: ${JSON.stringify(categoryAnalysis)}
        Recent Spending: ${JSON.stringify(spendingHistory.slice(0, 10))}
        
        Provide insights array with:
        - Comparison to historical spending patterns
        - Notable price comparisons
        - Unusual spending patterns
        - Budget implications
        - Shopping behavior observations
        - Recommendations for savings
        
        Return JSON array of insights.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a spending analysis expert. Provide actionable insights about shopping behavior and spending patterns.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 1000
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating spending insights:', error);
      return this.generateBasicInsights(currentReceipt, categoryAnalysis);
    }
  }

  private generateBasicInsights(receipt: any, categoryAnalysis: any): any[] {
    const insights = [];
    
    // Price comparison insights
    if (receipt.total > categoryAnalysis.averageTransaction * 1.5) {
      insights.push({
        type: 'high_spend',
        message: `This transaction is higher than your average for ${receipt.category}`,
        impact: 'negative',
        severity: 'medium'
      });
    }
    
    // Frequency insights
    if (categoryAnalysis.frequency === 'high' && categoryAnalysis.transactionCount > 15) {
      insights.push({
        type: 'frequency_warning',
        message: `You're shopping ${receipt.category} very frequently this month`,
        impact: 'neutral',
        severity: 'low'
      });
    }
    
    return insights;
  }

  private async analyzeBudgetImpact(userId: string, receipt: any): Promise<any> {
    try {
      // Get user's budget for the category
      const db = getDatabase();
      const budgetResult = await db.query(
        `SELECT * FROM user_budgets 
         WHERE user_id = $1 AND category = $2 
         AND month = EXTRACT(MONTH FROM CURRENT_DATE)
         AND year = EXTRACT(YEAR FROM CURRENT_DATE)`,
        [userId, receipt.category]
      );

      const budget = budgetResult.rows[0];
      
      if (!budget) {
        return {
          hasBudget: false,
          message: 'No budget set for this category'
        };
      }

      const spent = budget.spent || 0;
      const remaining = budget.amount - spent - receipt.total;
      const percentage = ((spent + receipt.total) / budget.amount) * 100;

      return {
        hasBudget: true,
        budgetAmount: budget.amount,
        previousSpent: spent,
        currentTransaction: receipt.total,
        newSpent: spent + receipt.total,
        remaining: Math.max(0, remaining),
        percentage: Math.min(100, percentage),
        status: percentage >= 100 ? 'exceeded' : percentage >= 90 ? 'warning' : 'on_track',
        daysRemaining: this.calculateDaysRemainingInMonth()
      };

    } catch (error) {
      logger.error('Error analyzing budget impact:', error);
      return { hasBudget: false };
    }
  }

  private calculateDaysRemainingInMonth(): number {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async getCrossAgentSpendingInsights(receipt: any): Promise<any[]> {
    const insights = [];

    // Dietitian insights for food receipts
    if (receipt.category === 'groceries' || receipt.category === 'dining') {
      insights.push({
        agent: 'dietitian',
        type: 'nutrition_opportunity',
        message: receipt.category === 'groceries' 
          ? 'Let me analyze your grocery choices for better meal planning'
          : 'I can suggest healthier alternatives for your dining choices',
        actionItems: [
          receipt.category === 'groceries' ? 'meal_planning' : 'healthy_alternatives',
          'budget_optimization'
        ]
      });
    }

    // Chore manager insights for household items
    if (receipt.items?.some(item => item.category === 'cleaning' || item.category === 'household')) {
      insights.push({
        agent: 'chore-manager',
        type: 'household_efficiency',
        message: 'These household items can be integrated into your chore schedule',
        actionItems: ['inventory_tracking', 'scheduled_purchases']
      });
    }

    return insights;
  }

  private async generateSpendingRecommendations(
    userId: string,
    receipt: any,
    budgetImpact: any
  ): Promise<any[]> {
    const recommendations = [];

    // Budget-based recommendations
    if (budgetImpact.status === 'warning' || budgetImpact.status === 'exceeded') {
      recommendations.push({
        type: 'budget_adjustment',
        priority: 'high',
        title: 'Budget Alert',
        description: `Consider reducing ${receipt.category} spending or adjusting your budget`,
        actionItems: ['review_budget', 'find_alternatives', 'delay_non_essential']
      });
    }

    // Savings opportunities
    if (receipt.total > 50 && receipt.category === 'dining') {
      recommendations.push({
        type: 'savings_opportunity',
        priority: 'medium',
        title: 'Cook at Home Savings',
        description: 'This dining expense could be replaced with home-cooked meals',
        estimatedSavings: receipt.total * 0.6, // 60% savings
        actionItems: ['meal_prep', 'grocery_planning', 'recipe_search']
      });
    }

    return recommendations;
  }

  private async findRelatedDeals(receipt: any): Promise<any[]> {
    try {
      // In production, would integrate with deal APIs
      // For now, provide placeholder deals
      
      if (receipt.category === 'groceries') {
        return [
          {
            store: receipt.merchant,
            type: 'weekly_special',
            description: '10% off produce this week',
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            potentialSavings: receipt.total * 0.1
          }
        ];
      }

      return [];
    } catch (error) {
      logger.error('Error finding related deals:', error);
      return [];
    }
  }

  private calculateCategoryRanking(categoryAnalysis: any, currentReceipt: any): any {
    return {
      percentile: this.calculateSpendingPercentile(categoryAnalysis, currentReceipt.total),
      ranking: this.getTransactionRanking(categoryAnalysis, currentReceipt.total)
    };
  }

  private calculateSpendingPercentile(categoryAnalysis: any, amount: number): number {
    // Simplified percentile calculation
    if (amount <= categoryAnalysis.minTransaction) return 10;
    if (amount <= categoryAnalysis.averageTransaction) return 50;
    if (amount <= categoryAnalysis.maxTransaction) return 80;
    return 95;
  }

  private getTransactionRanking(categoryAnalysis: any, amount: number): string {
    if (amount > categoryAnalysis.maxTransaction * 0.9) return 'highest';
    if (amount > categoryAnalysis.averageTransaction) return 'above_average';
    if (amount > categoryAnalysis.minTransaction) return 'below_average';
    return 'lowest';
  }

  private calculateSpendingTrend(spendingHistory: any[], currentReceipt: any): any {
    if (spendingHistory.length < 2) return 'insufficient_data';

    const recentSimilarTransactions = spendingHistory
      .filter(r => r.category === currentReceipt.category)
      .slice(0, 5);

    if (recentSimilarTransactions.length < 2) return 'insufficient_data';

    const amounts = recentSimilarTransactions.map(t => t.amount);
    const averageAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    
    if (currentReceipt.total > averageAmount * 1.2) return 'increasing';
    if (currentReceipt.total < averageAmount * 0.8) return 'decreasing';
    return 'stable';
  }

  private async analyzeImageQuality(imageData: string): Promise<any> {
    try {
      // Basic image quality analysis
      const imageSize = this.getImageSize(imageData);
      const sharpness = this.estimateSharpness(imageData);
      
      return {
        size: imageSize,
        sharpness,
        quality: this.calculateOverallQuality(imageSize, sharpness),
        recommendations: this.getImageRecommendations(imageSize, sharpness)
      };
    } catch (error) {
      logger.error('Error analyzing image quality:', error);
      return {};
    }
  }

  private getImageSize(imageData: string): { width: number; height: number } {
    // Extract image dimensions from base64
    const matches = imageData.match(/^data:image\/\w+;base64,(.+)$/);
    if (matches && matches[1]) {
      // In production, would use a proper image processing library
      return { width: 1920, height: 1080 }; // Placeholder
    }
    return { width: 0, height: 0 };
  }

  private estimateSharpness(imageData: string): 'high' | 'medium' | 'low' {
    // Simplified sharpness estimation
    return 'medium'; // Would analyze actual image in production
  }

  private calculateOverallQuality(size: any, sharpness: string): 'excellent' | 'good' | 'fair' | 'poor' {
    if (size.width < 800 || size.height < 600) return 'poor';
    if (sharpness === 'low') return 'fair';
    if (sharpness === 'medium') return 'good';
    return 'excellent';
  }

  private getImageRecommendations(size: any, sharpness: string): string[] {
    const recommendations = [];
    
    if (size.width < 800) {
      recommendations.push('Use higher resolution images for better OCR accuracy');
    }
    
    if (sharpness === 'low') {
      recommendations.push('Ensure receipt is flat and well-lit when taking photo');
    }
    
    return recommendations;
  }

  private async getLocationContext(): Promise<any> {
    // In production, would get user's current location
    return {
      available: false,
      message: 'Location services not enabled'
    };
  }

  private getTimeContext(): any {
    const now = new Date();
    return {
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      isBusinessHours: now.getHours() >= 9 && now.getHours() <= 17
    };
  }

  private analyzeSeasonality(receipt: any): any {
    const month = new Date().getMonth();
    const seasons = {
      winter: [11, 0, 1],
      spring: [2, 3, 4],
      summer: [5, 6, 7],
      fall: [8, 9, 10]
    };

    const currentSeason = Object.keys(seasons).find(season => 
      seasons[season].includes(month)
    );

    return {
      season: currentSeason,
      month,
      seasonalPatterns: this.getSeasonalSpendingPatterns(receipt.category, currentSeason as string)
    };
  }

  private getSeasonalSpendingPatterns(category: string, season: string): any {
    // Placeholder for seasonal spending patterns
    const patterns = {
      groceries: {
        winter: 'Higher spending on comfort foods',
        summer: 'More produce and BBQ items',
        fall: 'Back-to-school and holiday prep'
      },
      dining: {
        winter: 'More restaurant dining (holidays)',
        summer: 'Outdoor dining and ice cream',
        fall: 'Seasonal menu items'
      }
    };

    return patterns[category]?.[season] || 'No significant seasonal pattern';
  }

  private async autoCorrectReceiptData(parsedData: any, ocrText: string): Promise<any> {
    const corrections = [];

    // Auto-correct common OCR errors
    if (parsedData.total && parsedData.total > 1000) {
      corrections.push({
        type: 'decimal_point',
        original: parsedData.total,
        corrected: parsedData.total / 100,
        confidence: 0.8
      });
    }

    // Fix merchant name common errors
    if (parsedData.merchant) {
      const correctedMerchant = this.correctMerchantName(parsedData.merchant);
      if (correctedMerchant !== parsedData.merchant) {
        corrections.push({
          type: 'merchant_name',
          original: parsedData.merchant,
          corrected: correctedMerchant,
          confidence: 0.9
        });
      }
    }

    return corrections;
  }

  private correctMerchantName(merchant: string): string {
    const corrections = {
      'WALNART': 'WALMART',
      'TARQET': 'TARGET',
      'KROQER': 'KROGER',
      'STARBUCKS': 'STARBUCKS'
    };

    return corrections[merchant.toUpperCase()] || merchant;
  }

  private async addMissingInformation(parsedData: any, ocrText: string): Promise<any> {
    const enhanced = { ...parsedData };

    // Add missing currency
    if (!parsedData.currency && parsedData.total) {
      enhanced.currency = this.detectCurrency(ocrText);
    }

    // Standardize date format
    if (parsedData.date) {
      enhanced.date = this.standardizeDate(parsedData.date);
    }

    return enhanced;
  }

  private detectCurrency(text: string): string {
    if (text.includes('$') || text.includes('USD')) return 'USD';
    if (text.includes('€') || text.includes('EUR')) return 'EUR';
    if (text.includes('£') || text.includes('GBP')) return 'GBP';
    return 'USD'; // Default
  }

  private standardizeDate(date: string): string {
    try {
      const parsed = new Date(date);
      return parsed.toISOString().split('T')[0];
    } catch {
      return date;
    }
  }

  private estimateProcessingTime(imageData: string): number {
    // Estimate processing time based on image characteristics
    const size = this.getImageSize(imageData);
    const baseTime = 3; // Base 3 seconds
    
    // Adjust for image size
    if (size.width > 2000 || size.height > 2000) {
      return baseTime + 2;
    }
    
    return baseTime;
  }

  private startQueueProcessing(): void {
    setInterval(async () => {
      if (this.scanQueue.length > 0 && !this.processing) {
        await this.processNextInQueue();
      }
    }, 2000); // Check every 2 seconds
  }

  private async processNextInQueue(): Promise<void> {
    if (this.scanQueue.length === 0) return;

    this.processing = true;
    const job = this.scanQueue.shift();

    try {
      logger.info(`Processing receipt job ${job.id}`);

      // Step 1: OCR Processing
      const ocrResult = await this.processImageWithOCR(job.imageData);
      job.ocrResult = ocrResult;
      job.status = 'ocr_processing';

      // Step 2: AI Parsing
      const parsedData = await this.parseReceiptWithAI(ocrResult.text);
      job.parsedData = parsedData;
      job.status = 'parsing';

      // Step 3: Enhancement and Analysis
      const enhancedData = await this.enhanceReceiptWithMetadata(parsedData, job.imageData);
      job.enhancedData = enhancedData;
      job.status = 'enhancing';

      // Step 4: Store in database
      const receipt = await this.storeProcessedReceipt(job.userId, enhancedData);
      job.storedReceipt = receipt;
      job.status = 'completed';

      // Step 5: Generate spending analysis
      const analysis = await this.analyzeSpendingPatterns(job.userId, [receipt]);
      job.analysis = analysis;

      logger.info(`Receipt job ${job.id} completed successfully`);

      // Cache result
      await this.cacheReceiptResult(job.id, {
        receipt,
        analysis,
        processingTime: Date.now() - job.createdAt.getTime()
      });

    } catch (error) {
      logger.error(`Error processing receipt job ${job.id}:`, error);
      job.status = 'error';
      job.error = error.message;
    } finally {
      this.processing = false;
    }
  }

  private async storeProcessedReceipt(userId: string, receiptData: any): Promise<any> {
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
        imageUrl: receiptData.metadata?.imageUrl || '',
        processedAt: new Date()
      };

      // Store receipt
      await db.query(
        `INSERT INTO receipts (id, user_id, merchant, amount, currency, category, date, items, image_url, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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

      // Store receipt image
      if (receiptData.metadata?.imageUrl) {
        await db.query(
          `INSERT INTO receipt_images (id, receipt_id, image_data, metadata, file_name, file_size, mime_type, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            this.generateId(),
            receipt.id,
            receiptData.metadata.imageUrl,
            JSON.stringify(receiptData.metadata),
            receiptData.metadata.fileName || 'receipt.jpg',
            receiptData.metadata.fileSize || 0,
            receiptData.metadata.mimeType || 'image/jpeg'
          ]
        );
      }

      // Create validation log
      await this.createValidationLog(receipt.id, userId, 'ocr_confidence', receiptData.confidence || 0.7);

      // Log spending pattern
      await this.logSpendingPattern(userId, receiptData);

      return receipt;
    } catch (error) {
      logger.error('Error storing processed receipt:', error);
      throw error;
    }
  }

  private async createValidationLog(receiptId: string, userId: string, type: string, score: number): Promise<void> {
    try {
      const db = getDatabase();
      await db.query(
        `INSERT INTO receipt_validation_logs (id, receipt_id, user_id, validation_type, result, score, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          this.generateId(),
          receiptId,
          userId,
          type,
          score >= 0.7 ? 'passed' : score >= 0.5 ? 'warning' : 'failed',
          score
        ]
      );
    } catch (error) {
      logger.error('Error creating validation log:', error);
    }
  }

  private async logSpendingPattern(userId: string, receiptData: any): Promise<void> {
    try {
      const db = getDatabase();
      const date = new Date(receiptData.date || Date.now());
      
      await db.query(
        `INSERT INTO spending_patterns (id, user_id, category, merchant, day_of_week, hour_of_day, average_amount, transaction_count, pattern_type, confidence_score, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'transaction', 75.0, NOW())`,
        [
          this.generateId(),
          userId,
          receiptData.category,
          receiptData.merchant,
          date.getDay(),
          date.getHours(),
          receiptData.total || 0,
          1,
          'transaction',
          75.0
        ]
      );
    } catch (error) {
      logger.error('Error logging spending pattern:', error);
    }
  }

  async getProcessingResult(jobId: string): Promise<any> {
    try {
      const redis = getRedis();
      const cached = await redis.get(`receipt_result:${jobId}`);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting processing result:', error);
      return null;
    }
  }

  async getUserReceipts(filters: any): Promise<any> {
    try {
      const db = getDatabase();
      
      let sql = `
        SELECT r.*, ri.file_name, ri.file_size
        FROM receipts r
        LEFT JOIN receipt_images ri ON r.id = ri.receipt_id
        WHERE r.user_id = $1
      `;
      const params = [filters.userId];

      // Add filters
      if (filters.category) {
        sql += ` AND r.category = $${params.length + 1}`;
        params.push(filters.category);
      }

      if (filters.merchant) {
        sql += ` AND r.merchant ILIKE $${params.length + 1}`;
        params.push(`%${filters.merchant}%`);
      }

      if (filters.dateFrom) {
        sql += ` AND r.date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        sql += ` AND r.date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      if (filters.minAmount) {
        sql += ` AND r.amount >= $${params.length + 1}`;
        params.push(filters.minAmount);
      }

      if (filters.maxAmount) {
        sql += ` AND r.amount <= $${params.length + 1}`;
        params.push(filters.maxAmount);
      }

      // Add sorting
      sql += ` ORDER BY r.${filters.sortBy} ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

      // Add pagination
      const offset = (filters.page - 1) * filters.limit;
      sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(filters.limit, offset);

      const result = await db.query(sql, params);

      // Get total count for pagination
      const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
      const countResult = await db.query(countSql, params.slice(0, -2)); // Remove limit/offset for count
      const totalCount = parseInt(countResult.rows[0].count);

      // Calculate summary
      const summary = await this.calculateReceiptSummary(result.rows);

      return {
        receipts: result.rows,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / filters.limit),
          hasNext: offset + result.rows.length < totalCount
        },
        summary
      };
    } catch (error) {
      logger.error('Error getting user receipts:', error);
      throw error;
    }
  }

  private async calculateReceiptSummary(receipts: any[]): Promise<any> {
    try {
      if (receipts.length === 0) {
        return {
          totalAmount: 0,
          averageAmount: 0,
          transactionCount: 0,
          topCategory: null,
          topMerchant: null
        };
      }

      const totalAmount = receipts.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      const averageAmount = totalAmount / receipts.length;
      
      // Category breakdown
      const categoryBreakdown = receipts.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + parseFloat(r.amount);
        return acc;
      }, {});
      
      const topCategory = Object.entries(categoryBreakdown)
        .sort(([,a], [,b]) => b - a)[0];

      // Merchant breakdown
      const merchantBreakdown = receipts.reduce((acc, r) => {
        acc[r.merchant] = (acc[r.merchant] || 0) + 1;
        return acc;
      }, {});
      
      const topMerchant = Object.entries(merchantBreakdown)
        .sort(([,a], [,b]) => b - a)[0];

      return {
        totalAmount,
        averageAmount,
        transactionCount: receipts.length,
        topCategory: topCategory ? topCategory[0] : null,
        topMerchant: topMerchant ? topMerchant[0] : null,
        categoryBreakdown
      };
    } catch (error) {
      logger.error('Error calculating receipt summary:', error);
      return {};
    }
  }

  async getReceiptById(receiptId: string, userId: string): Promise<any> {
    try {
      const db = getDatabase();
      const result = await db.query(
        `SELECT r.*, ri.image_data, ri.metadata, ri.file_name, ri.file_size, ri.mime_type
         FROM receipts r
         LEFT JOIN receipt_images ri ON r.id = ri.receipt_id
         WHERE r.id = $1 AND r.user_id = $2`,
        [receiptId, userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting receipt by ID:', error);
      return null;
    }
  }

  async updateReceipt(receiptId: string, userId: string, updateData: any): Promise<any> {
    try {
      const db = getDatabase();
      
      // Build update query dynamically
      const updates = [];
      const params = [receiptId, userId];

      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          updates.push(`${key} = $${params.length + 1}`);
          params.push(updateData[key]);
        }
      });

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      const sql = `
        UPDATE receipts 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
      `;

      await db.query(sql, params);

      // Log correction
      for (const field of Object.keys(updateData)) {
        await this.logCorrection(receiptId, userId, field, updateData[field]);
      }

      return await this.getReceiptById(receiptId, userId);
    } catch (error) {
      logger.error('Error updating receipt:', error);
      throw error;
    }
  }

  private async logCorrection(receiptId: string, userId: string, field: string, newValue: any): Promise<void> {
    try {
      const db = getDatabase();
      
      // Get original value for logging
      const originalResult = await db.query(
        `SELECT ${field} FROM receipts WHERE id = $1`,
        [receiptId]
      );

      if (originalResult.rows.length > 0) {
        await db.query(
          `INSERT INTO receipt_corrections (id, receipt_id, user_id, field_name, original_value, corrected_value, applied_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            this.generateId(),
            receiptId,
            userId,
            field,
            originalResult.rows[0][field],
            newValue
          ]
        );
      }
    } catch (error) {
      logger.error('Error logging correction:', error);
    }
  }

  async deleteReceipt(receiptId: string, userId: string): Promise<boolean> {
    try {
      const db = getDatabase();
      const result = await db.query(
        'DELETE FROM receipts WHERE id = $1 AND user_id = $2',
        [receiptId, userId]
      );

      return result.rowCount > 0;
    } catch (error) {
      logger.error('Error deleting receipt:', error);
      return false;
    }
  }

  async getSpendingAnalytics(userId: string, options: any): Promise<any> {
    try {
      const db = getDatabase();
      
      // Calculate date range based on period
      let dateCondition = '';
      let dateParams = [];
      
      if (options.period === 'weekly') {
        dateCondition = 'AND date >= NOW() - INTERVAL \'1 week\'';
      } else if (options.period === 'monthly') {
        dateCondition = 'AND date >= NOW() - INTERVAL \'1 month\'';
      }
      
      let sql = `
        SELECT 
          category,
          COUNT(*) as transaction_count,
          SUM(amount) as total_spent,
          AVG(amount) as average_transaction,
          MIN(amount) as min_transaction,
          MAX(amount) as max_transaction
        FROM receipts 
        WHERE user_id = $1 ${dateCondition}
      `;
      
      const params = [userId];
      
      if (options.category) {
        sql += ` AND category = $${params.length + 1}`;
        params.push(options.category);
      }
      
      if (options.dateFrom) {
        sql += ` AND date >= $${params.length + 1}`;
        params.push(options.dateFrom);
      }
      
      if (options.dateTo) {
        sql += ` AND date <= $${params.length + 1}`;
        params.push(options.dateTo);
      }
      
      sql += ` GROUP BY category ORDER BY total_spent DESC`;

      const result = await db.query(sql, params);

      return {
        categoryBreakdown: result.rows,
        totalCategories: result.rows.length,
        period: options.period,
        insights: await this.generateAnalyticsInsights(result.rows)
      };
    } catch (error) {
      logger.error('Error getting spending analytics:', error);
      throw error;
    }
  }

  async getCategoryBreakdown(userId: string, period: string): Promise<any> {
    try {
      const analytics = await this.getSpendingAnalytics(userId, { period });
      
      return {
        categories: analytics.categoryBreakdown,
        total: analytics.categoryBreakdown.reduce((sum, cat) => sum + cat.total_spent, 0),
        insights: analytics.insights
      };
    } catch (error) {
      logger.error('Error getting category breakdown:', error);
      throw error;
    }
  }

  async getMerchantBreakdown(userId: string, period: string, limit: number): Promise<any> {
    try {
      const db = getDatabase();
      
      let dateCondition = '';
      if (period === 'weekly') {
        dateCondition = 'AND date >= NOW() - INTERVAL \'1 week\'';
      } else if (period === 'monthly') {
        dateCondition = 'AND date >= NOW() - INTERVAL \'1 month\'';
      }
      
      const result = await db.query(
        `SELECT 
           merchant,
           COUNT(*) as visit_count,
           SUM(amount) as total_spent,
           AVG(amount) as average_transaction
         FROM receipts 
         WHERE user_id = $1 ${dateCondition}
         GROUP BY merchant 
         ORDER BY total_spent DESC 
         LIMIT $2`,
        [userId, limit]
      );

      return {
        merchants: result.rows,
        totalMerchants: result.rows.length,
        insights: await this.generateMerchantInsights(result.rows)
      };
    } catch (error) {
      logger.error('Error getting merchant breakdown:', error);
      throw error;
    }
  }

  private async generateAnalyticsInsights(categories: any[]): Promise<any[]> {
    try {
      const insights = [];
      
      const totalSpent = categories.reduce((sum, cat) => sum + cat.total_spent, 0);
      
      // Find top spending category
      const topCategory = categories[0];
      if (topCategory) {
        const percentage = (topCategory.total_spent / totalSpent * 100).toFixed(1);
        insights.push({
          type: 'top_category',
          message: `Your top spending category is ${topCategory.category} at ${percentage}% of total spending`,
          severity: 'info'
        });
      }
      
      return insights;
    } catch (error) {
      logger.error('Error generating analytics insights:', error);
      return [];
    }
  }

  private async generateMerchantInsights(merchants: any[]): Promise<any[]> {
    try {
      const insights = [];
      
      // Most visited merchant
      const topMerchant = merchants[0];
      if (topMerchant) {
        insights.push({
          type: 'frequent_merchant',
          message: `You visit ${topMerchant.merchant} most frequently (${topMerchant.visit_count} times)`,
          severity: 'info'
        });
      }
      
      return insights;
    } catch (error) {
      logger.error('Error generating merchant insights:', error);
      return [];
    }
  }

  async retryProcessing(receiptId: string, userId: string, originalReceipt: any, options: any): Promise<any> {
    try {
      // Create new job with enhanced options
      const retryJob = {
        id: this.generateId(),
        userId,
        imageData: originalReceipt.imageUrl || '',
        options: {
          ...options,
          retry: true,
          originalReceiptId: receiptId,
          enhancedProcessing: true
        },
        status: 'queued',
        createdAt: new Date()
      };

      this.scanQueue.push(retryJob);
      
      return {
        jobId: retryJob.id,
        estimatedTime: this.estimateProcessingTime(retryJob.imageData)
      };
    } catch (error) {
      logger.error('Error retrying processing:', error);
      throw error;
    }
  }

  private async cacheReceiptResult(jobId: string, result: any): Promise<void> {
    try {
      const redis = getRedis();
      await redis.setex(
        `receipt_result:${jobId}`,
        3600, // 1 hour cache
        JSON.stringify(result)
      );
    } catch (error) {
      logger.error('Error caching receipt result:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
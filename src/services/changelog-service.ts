import { ChangelogEntry, ProgressEntry, Goal, User } from '../types';
import { logger } from '../utils/logger';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';

export class ChangelogService {
  private openai: any;

  constructor() {
    this.initializeOpenAI();
  }

  private async initializeOpenAI(): Promise<void> {
    try {
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } catch (error) {
      logger.error('Failed to initialize OpenAI for changelog:', error);
    }
  }

  async createChangelogEntry(
    userId: string,
    type: string,
    title: string,
    description: string,
    agentId?: string,
    goalId?: string,
    impact: 'positive' | 'negative' | 'neutral' = 'neutral',
    tags: string[] = []
  ): Promise<ChangelogEntry> {
    try {
      // Generate AI insights for the entry
      const insights = await this.generateInsights(type, description, impact);
      
      // Create comprehensive entry
      const entry: ChangelogEntry = {
        id: this.generateId(),
        userId,
        type: type as any,
        title,
        description,
        agentId,
        goalId,
        impact,
        tags: [...tags, ...insights.suggestedTags],
        timestamp: new Date()
      };

      // Store in database
      await this.storeChangelogEntry(entry);
      
      // Cache for quick access
      await this.cacheChangelogEntry(entry);
      
      // Update related goal progress if applicable
      if (goalId) {
        await this.updateGoalProgress(goalId, entry);
      }
      
      // Generate notifications
      await this.generateNotifications(entry, insights);
      
      logger.info(`Changelog entry created for user ${userId}: ${title}`);
      
      return entry;

    } catch (error) {
      logger.error('Error creating changelog entry:', error);
      throw error;
    }
  }

  async getChangelog(
    userId: string,
    filters: {
      dateRange?: { start: Date; end: Date };
      types?: string[];
      agents?: string[];
      goals?: string[];
      impact?: ('positive' | 'negative' | 'neutral')[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any> {
    try {
      // Build query based on filters
      const query = this.buildChangelogQuery(filters);
      const result = await getDatabase().query(query.sql, query.params);
      
      // Enhance entries with AI-generated summaries
      const enhancedEntries = await Promise.all(
        result.rows.map(entry => this.enhanceChangelogEntry(entry))
      );
      
      // Get analytics and trends
      const analytics = await this.getChangelogAnalytics(userId, enhancedEntries);
      
      return {
        entries: enhancedEntries,
        total: result.rowCount || enhancedEntries.length,
        analytics,
        filters: filters,
        hasMore: (filters.offset || 0) + enhancedEntries.length < (result.rowCount || 0)
      };

    } catch (error) {
      logger.error('Error getting changelog:', error);
      throw error;
    }
  }

  async getChangelogSummary(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<any> {
    try {
      // Get date range for the period
      const dateRange = this.getDateRange(period);
      
      // Get entries for the period
      const result = await getDatabase().query(
        `SELECT * FROM changelog_entries 
         WHERE user_id = $1 
         AND timestamp >= $2 
         AND timestamp <= $3
         ORDER BY timestamp DESC`,
        [userId, dateRange.start, dateRange.end]
      );

      // Analyze patterns and generate insights
      const analysis = await this.analyzePeriodTrends(result.rows, period);
      
      // Generate AI-powered summary
      const summary = await this.generatePeriodSummary(result.rows, period, analysis);
      
      return {
        period,
        dateRange,
        summary,
        analysis,
        entries: result.rows,
        milestones: this.identifyMilestones(result.rows),
        setbacks: this.identifySetbacks(result.rows),
        breakthroughs: this.identifyBreakthroughs(result.rows)
      };

    } catch (error) {
      logger.error('Error getting changelog summary:', error);
      throw error;
    }
  }

  async trackAgentActivity(
    userId: string,
    agentId: string,
    activity: string,
    data: any = {}
  ): Promise<void> {
    try {
      // Create agent activity log
      const activityEntry = {
        id: this.generateId(),
        userId,
        agentId,
        activity,
        data: JSON.stringify(data),
        timestamp: new Date()
      };

      // Store agent activity
      await getDatabase().query(
        `INSERT INTO agent_activity_log (id, user_id, agent_id, activity, data, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          activityEntry.id,
          activityEntry.userId,
          activityEntry.agentId,
          activityEntry.activity,
          activityEntry.data,
          activityEntry.timestamp
        ]
      );

      // Update agent performance metrics
      await this.updateAgentPerformance(agentId, activity, data);

    } catch (error) {
      logger.error('Error tracking agent activity:', error);
    }
  }

  async generateProgressReport(
    userId: string,
    goalId?: string,
    period: 'weekly' | 'monthly' = 'monthly'
  ): Promise<any> {
    try {
      // Get user's goals
      const goals = goalId 
        ? await this.getGoal(goalId)
        : await this.getUserGoals(userId);

      // Get progress entries for the period
      const progressEntries = await this.getProgressEntries(userId, goalId, period);
      
      // Get changelog entries for the period
      const changelogEntries = await this.getChangelogEntries(userId, goalId, period);
      
      // Generate comprehensive progress report
      const report = await this.generateProgressAnalysis(
        goals,
        progressEntries,
        changelogEntries,
        period
      );

      return {
        period,
        goals,
        report,
        recommendations: await this.generateProgressRecommendations(report),
        nextMilestones: await this.getNextMilestones(goals),
        agentInsights: await this.getAgentProgressInsights(userId, goalId)
      };

    } catch (error) {
      logger.error('Error generating progress report:', error);
      throw error;
    }
  }

  private async generateInsights(
    type: string,
    description: string,
    impact: string
  ): Promise<any> {
    try {
      if (!this.openai) {
        return { suggestedTags: [], insights: [] };
      }

      const prompt = `
        Analyze this life coach event and generate insights:
        
        Type: ${type}
        Description: ${description}
        Impact: ${impact}
        
        Provide:
        - suggestedTags: 3-5 relevant tags for categorization
        - insights: 2-3 brief insights about what this means for user's progress
        - significance: low/medium/high impact on overall life improvement
        
        Return JSON with insights analysis.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a life coaching analytics expert. Provide insightful analysis of user progress events.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 500
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating insights:', error);
      return { suggestedTags: [], insights: [] };
    }
  }

  private async storeChangelogEntry(entry: ChangelogEntry): Promise<void> {
    try {
      await getDatabase().query(
        `INSERT INTO changelog_entries (id, user_id, type, title, description, agent_id, goal_id, impact, tags, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.id,
          entry.userId,
          entry.type,
          entry.title,
          entry.description,
          entry.agentId,
          entry.goalId,
          entry.impact,
          JSON.stringify(entry.tags),
          entry.timestamp
        ]
      );
    } catch (error) {
      logger.error('Error storing changelog entry:', error);
      throw error;
    }
  }

  private async cacheChangelogEntry(entry: ChangelogEntry): Promise<void> {
    try {
      await getRedis().lPush(
        `changelog:${entry.userId}`,
        JSON.stringify(entry)
      );

      // Keep only recent 100 entries in cache
      await getRedis().lTrim(`changelog:${entry.userId}`, 0, 99);

      // Set expiration for 24 hours
      await getRedis().expire(`changelog:${entry.userId}`, 86400);
    } catch (error) {
      logger.error('Error caching changelog entry:', error);
    }
  }

  private async updateGoalProgress(goalId: string, entry: ChangelogEntry): Promise<void> {
    try {
      // Update goal based on changelog entry
      const updateData = this.calculateGoalUpdate(entry);
      
      if (Object.keys(updateData).length > 0) {
        await getDatabase().query(
          `UPDATE goals 
           SET ${Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ')}, updated_at = NOW()
           WHERE id = $1`,
          [goalId, ...Object.values(updateData)]
        );
      }
    } catch (error) {
      logger.error('Error updating goal progress:', error);
    }
  }

  private calculateGoalUpdate(entry: ChangelogEntry): any {
    const update: any = {};

    switch (entry.type) {
      case 'goal_completed':
        update.status = 'completed';
        update.completed_at = entry.timestamp;
        break;
        
      case 'milestone_reached':
        update.current_value = 'current_value + 1'; // Would need proper calculation
        break;
        
      case 'setback':
        update.setback_count = 'setback_count + 1';
        break;
    }

    return update;
  }

  private async generateNotifications(entry: ChangelogEntry, insights: any): Promise<void> {
    try {
      // Create appropriate notifications based on entry type and impact
      const notifications = [];

      if (entry.impact === 'positive') {
        notifications.push({
          type: 'achievement',
          title: 'Great Progress!',
          message: entry.title,
          priority: 'medium'
        });
      }

      if (entry.type === 'goal_completed') {
        notifications.push({
          type: 'milestone',
          title: 'Goal Achieved! 🎉',
          message: `Congratulations on completing: ${entry.title}`,
          priority: 'high'
        });
      }

      // Store notifications
      for (const notification of notifications) {
        await getDatabase().query(
          `INSERT INTO notifications (id, user_id, type, title, message, priority, data, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            this.generateId(),
            entry.userId,
            notification.type,
            notification.title,
            notification.message,
            notification.priority,
            JSON.stringify({ entryId: entry.id, insights }),
            new Date()
          ]
        );
      }
    } catch (error) {
      logger.error('Error generating notifications:', error);
    }
  }

  private async enhanceChangelogEntry(entry: any): Promise<any> {
    try {
      // Add AI-generated insights if not already present
      if (!entry.aiInsights) {
        entry.aiInsights = await this.generateInsights(
          entry.type,
          entry.description,
          entry.impact
        );
      }

      // Add relative time
      entry.relativeTime = this.getRelativeTime(entry.timestamp);

      // Add related entries
      entry.relatedEntries = await this.getRelatedEntries(entry);

      return entry;
    } catch (error) {
      logger.error('Error enhancing changelog entry:', error);
      return entry;
    }
  }

  private buildChangelogQuery(filters: any): { sql: string; params: any[] } {
    let sql = `
      SELECT *, 
             (SELECT COUNT(*) FROM changelog_entries ce2 WHERE ce2.user_id = changelog_entries.user_id) as total_entries
      FROM changelog_entries 
      WHERE user_id = $1
    `;
    
    const params: any[] = [filters.userId || ''];

    // Add filters
    if (filters.dateRange) {
      sql += ` AND timestamp >= $${params.length + 1} AND timestamp <= $${params.length + 2}`;
      params.push(filters.dateRange.start, filters.dateRange.end);
    }

    if (filters.types && filters.types.length > 0) {
      sql += ` AND type = ANY($${params.length + 1})`;
      params.push(filters.types);
    }

    if (filters.agents && filters.agents.length > 0) {
      sql += ` AND agent_id = ANY($${params.length + 1})`;
      params.push(filters.agents);
    }

    if (filters.impact && filters.impact.length > 0) {
      sql += ` AND impact = ANY($${params.length + 1})`;
      params.push(filters.impact);
    }

    sql += ` ORDER BY timestamp DESC`;

    if (filters.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(filters.offset);
    }

    return { sql, params };
  }

  private async getChangelogAnalytics(userId: string, entries: any[]): Promise<any> {
    try {
      // Calculate various metrics
      const totalEntries = entries.length;
      const positiveEntries = entries.filter(e => e.impact === 'positive').length;
      const negativeEntries = entries.filter(e => e.impact === 'negative').length;
      const neutralEntries = entries.filter(e => e.impact === 'neutral').length;

      // Agent activity breakdown
      const agentBreakdown = this.calculateAgentBreakdown(entries);
      
      // Type distribution
      const typeDistribution = this.calculateTypeDistribution(entries);
      
      // Tag frequency
      const tagFrequency = this.calculateTagFrequency(entries);

      // Timeline patterns
      const timelinePatterns = this.calculateTimelinePatterns(entries);

      return {
        totalEntries,
        impactDistribution: {
          positive: positiveEntries,
          negative: negativeEntries,
          neutral: neutralEntries,
          positivePercentage: (positiveEntries / totalEntries * 100).toFixed(1)
        },
        agentBreakdown,
        typeDistribution,
        topTags: tagFrequency.slice(0, 10),
        timelinePatterns,
        consistency: this.calculateConsistencyScore(entries)
      };
    } catch (error) {
      logger.error('Error getting changelog analytics:', error);
      return {};
    }
  }

  private calculateAgentBreakdown(entries: any[]): any {
    const breakdown = {};
    
    entries.forEach(entry => {
      if (entry.agentId) {
        breakdown[entry.agentId] = (breakdown[entry.agentId] || 0) + 1;
      }
    });

    return breakdown;
  }

  private calculateTypeDistribution(entries: any[]): any {
    const distribution = {};
    
    entries.forEach(entry => {
      distribution[entry.type] = (distribution[entry.type] || 0) + 1;
    });

    return distribution;
  }

  private calculateTagFrequency(entries: any[]): any[] {
    const tagCount = {};
    
    entries.forEach(entry => {
      if (entry.tags) {
        (Array.isArray(entry.tags) ? entry.tags : []).forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      }
    });

    return Object.entries(tagCount)
      .sort(([,a], [,b]) => b - a)
      .map(([tag, count]) => ({ tag, count }));
  }

  private calculateTimelinePatterns(entries: any[]): any {
    // Analyze when user is most active
    const hourlyActivity = new Array(24).fill(0);
    const dailyActivity = new Array(7).fill(0);

    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      hourlyActivity[date.getHours()]++;
      dailyActivity[date.getDay()]++;
    });

    return {
      hourlyActivity,
      dailyActivity,
      mostActiveHour: hourlyActivity.indexOf(Math.max(...hourlyActivity)),
      mostActiveDay: dailyActivity.indexOf(Math.max(...dailyActivity))
    };
  }

  private calculateConsistencyScore(entries: any[]): number {
    // Calculate how consistent user activity is
    if (entries.length === 0) return 0;

    const dates = entries.map(e => new Date(e.timestamp).toDateString());
    const uniqueDates = [...new Set(dates)].length;
    const dateRange = this.getDateRangeFromEntries(entries);
    const totalDays = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));

    return (uniqueDates / totalDays) * 100;
  }

  private getDateRangeFromEntries(entries: any[]): { start: Date; end: Date } {
    if (entries.length === 0) {
      const now = new Date();
      return { start: now, end: now };
    }

    const timestamps = entries.map(e => new Date(e.timestamp).getTime());
    return {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps))
    };
  }

  private getDateRange(period: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date();

    switch (period) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        start.setDate(now.getDate());
        break;
      case 'weekly':
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        start.setMonth(now.getMonth());
        break;
    }

    return { start, end: now };
  }

  private getRelativeTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  private async getRelatedEntries(entry: any): Promise<any[]> {
    try {
      // Find related entries based on tags, type, and agent
      const result = await getDatabase().query(
        `SELECT * FROM changelog_entries 
         WHERE user_id = $1 
         AND id != $2 
         AND (type = $3 OR agent_id = $4 OR tags && $5)
         ORDER BY timestamp DESC 
         LIMIT 5`,
        [
          entry.user_id,
          entry.id,
          entry.type,
          entry.agent_id,
          JSON.stringify(entry.tags)
        ]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting related entries:', error);
      return [];
    }
  }

  private async analyzePeriodTrends(entries: any[], period: string): Promise<any> {
    try {
      // Generate AI-powered trend analysis
      if (!this.openai) {
        return { trends: [], patterns: [], recommendations: [] };
      }

      const prompt = `
        Analyze life coach progress trends for this ${period} period:
        
        Entries: ${JSON.stringify(entries.slice(0, 20))} // Limit to recent entries
        
        Provide analysis with:
        - trends: Key patterns and trends in user's progress
        - patterns: Repeating behaviors or outcomes
        - areas: Areas of improvement or concern
        - successes: Notable achievements or positive changes
        
        Return JSON with trend analysis.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a life coaching analytics expert. Identify patterns and trends in user progress data.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 1000
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error analyzing period trends:', error);
      return { trends: [], patterns: [], recommendations: [] };
    }
  }

  private async generatePeriodSummary(
    entries: any[],
    period: string,
    analysis: any
  ): Promise<any> {
    try {
      if (!this.openai) {
        return { title: `${period} Summary`, highlights: [], keyInsights: [] };
      }

      const prompt = `
        Generate a concise ${period} summary for life coaching progress:
        
        Data Summary:
        - Total Entries: ${entries.length}
        - Trends: ${JSON.stringify(analysis.trends || [])}
        - Patterns: ${JSON.stringify(analysis.patterns || [])}
        - Successes: ${JSON.stringify(analysis.successes || [])}
        
        Create a summary with:
        - title: Catchy summary title
        - highlights: 3-5 key achievements or events
        - keyInsights: 2-3 important insights or learnings
        - encouragement: Brief motivational message
        
        Return JSON with engaging summary.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an encouraging life coach. Create motivating progress summaries.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        maxTokens: 800
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating period summary:', error);
      return { title: `${period} Summary`, highlights: [], keyInsights: [] };
    }
  }

  private identifyMilestones(entries: any[]): any[] {
    return entries.filter(entry => 
      entry.type === 'milestone_reached' || entry.type === 'goal_completed'
    );
  }

  private identifySetbacks(entries: any[]): any[] {
    return entries.filter(entry => 
      entry.type === 'setback' || entry.impact === 'negative'
    );
  }

  private identifyBreakthroughs(entries: any[]): any[] {
    return entries.filter(entry => 
      entry.type === 'breakthrough' || 
      (entry.impact === 'positive' && entry.description.toLowerCase().includes('breakthrough'))
    );
  }

  private async updateAgentPerformance(agentId: string, activity: string, data: any): Promise<void> {
    try {
      // Update agent performance metrics in Redis
      const key = `agent_performance:${agentId}`;
      const current = await getRedis().hGetAll(key) || {};
      
      // Update activity counts
      current[`${activity}_count`] = (parseInt(current[`${activity}_count`] || '0') || 0) + 1;
      current.last_activity = new Date().toISOString();
      
      await getRedis().hSet(key, current);
      await getRedis().expire(key, 86400); // 24 hours
    } catch (error) {
      logger.error('Error updating agent performance:', error);
    }
  }

  private async getGoal(goalId: string): Promise<any> {
    try {
      const result = await getDatabase().query(
        'SELECT * FROM goals WHERE id = $1',
        [goalId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting goal:', error);
      return null;
    }
  }

  private async getUserGoals(userId: string): Promise<any[]> {
    try {
      const result = await getDatabase().query(
        'SELECT * FROM goals WHERE user_id = $1 AND status = $2',
        [userId, 'active']
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting user goals:', error);
      return [];
    }
  }

  private async getProgressEntries(userId: string, goalId?: string, period?: string): Promise<any[]> {
    try {
      let sql = `
        SELECT * FROM progress_entries 
        WHERE user_id = $1
      `;
      const params = [userId];

      if (goalId) {
        sql += ` AND goal_id = $${params.length + 1}`;
        params.push(goalId);
      }

      if (period) {
        const dateRange = this.getDateRange(period);
        sql += ` AND timestamp >= $${params.length + 1} AND timestamp <= $${params.length + 2}`;
        params.push(dateRange.start, dateRange.end);
      }

      sql += ` ORDER BY timestamp DESC`;

      const result = await getDatabase().query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting progress entries:', error);
      return [];
    }
  }

  private async getChangelogEntries(userId: string, goalId?: string, period?: string): Promise<any[]> {
    try {
      let sql = `
        SELECT * FROM changelog_entries 
        WHERE user_id = $1
      `;
      const params = [userId];

      if (goalId) {
        sql += ` AND goal_id = $${params.length + 1}`;
        params.push(goalId);
      }

      if (period) {
        const dateRange = this.getDateRange(period);
        sql += ` AND timestamp >= $${params.length + 1} AND timestamp <= $${params.length + 2}`;
        params.push(dateRange.start, dateRange.end);
      }

      sql += ` ORDER BY timestamp DESC`;

      const result = await getDatabase().query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting changelog entries:', error);
      return [];
    }
  }

  private async generateProgressAnalysis(
    goals: any[],
    progressEntries: any[],
    changelogEntries: any[],
    period: string
  ): Promise<any> {
    try {
      if (!this.openai) {
        return { summary: '', details: [], recommendations: [] };
      }

      const prompt = `
        Generate comprehensive progress analysis based on:
        
        Goals: ${JSON.stringify(goals)}
        Progress Entries: ${JSON.stringify(progressEntries.slice(0, 10))}
        Changelog Entries: ${JSON.stringify(changelogEntries.slice(0, 10))}
        Period: ${period}
        
        Provide analysis with:
        - summary: Overall progress summary
        - achievements: Key accomplishments
        - challenges: Obstacles or setbacks
        - trends: Progress patterns
        - momentum: Current momentum level (high/medium/low)
        
        Return JSON with detailed progress analysis.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a progress analysis expert. Provide comprehensive, encouraging assessments of user progress.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 1500
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating progress analysis:', error);
      return { summary: '', details: [], recommendations: [] };
    }
  }

  private async generateProgressRecommendations(analysis: any): Promise<any[]> {
    try {
      if (!analysis.recommendations) {
        return [];
      }

      return analysis.recommendations.map(rec => ({
        ...rec,
        priority: this.calculateRecommendationPriority(rec),
        actionable: this.isActionable(rec)
      }));
    } catch (error) {
      logger.error('Error generating progress recommendations:', error);
      return [];
    }
  }

  private calculateRecommendationPriority(recommendation: any): 'low' | 'medium' | 'high' {
    if (recommendation.urgency === 'high') return 'high';
    if (recommendation.impact === 'high') return 'medium';
    return 'low';
  }

  private isActionable(recommendation: any): boolean {
    return !!(recommendation.action || recommendation.steps);
  }

  private async getNextMilestones(goals: any[]): Promise<any[]> {
    return goals
      .filter(goal => goal.status === 'active' && goal.deadline)
      .map(goal => ({
        goalId: goal.id,
        goalTitle: goal.title,
        nextMilestone: this.calculateNextMilestone(goal),
        daysUntilMilestone: this.calculateDaysUntil(goal.deadline)
      }));
  }

  private calculateNextMilestone(goal: any): any {
    // Calculate what the next milestone should be
    const progress = goal.current_value || 0;
    const target = goal.target_value || 100;
    const nextMilestone = Math.min(progress + (target - progress) * 0.25, target);
    
    return {
      value: nextMilestone,
      percentage: (nextMilestone / target * 100).toFixed(1)
    };
  }

  private calculateDaysUntil(deadline: Date): number {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    return Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async getAgentProgressInsights(userId: string, goalId?: string): Promise<any[]> {
    try {
      // Get insights from all agents about user progress
      const insights = [];

      // This would coordinate with the agent communication hub
      // to get insights from each specialist agent

      return insights;
    } catch (error) {
      logger.error('Error getting agent progress insights:', error);
      return [];
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
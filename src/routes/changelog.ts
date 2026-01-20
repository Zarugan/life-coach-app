import { Request, Response } from 'express';
import { ChangelogService } from '../services/changelog-service';
import { logger } from '../utils/logger';

export function setupChangelogRoutes(app: any): void {
  const changelogService = new ChangelogService();

  // Create changelog entry
  app.post('/api/changelog/entries', async (req: Request, res: Response, next: Function) => {
    try {
      const { type, title, description, agentId, goalId, impact, tags } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const entry = await changelogService.createChangelogEntry(
        userId,
        type,
        title,
        description,
        agentId,
        goalId,
        impact,
        tags
      );

      res.json({
        success: true,
        entry
      });

    } catch (error) {
      next(error);
    }
  });

  // Get changelog with filters
  app.get('/api/changelog', async (req: Request, res: Response, next: Function) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const filters = {
        userId,
        dateRange: req.query.dateRange ? JSON.parse(req.query.dateRange as string) : undefined,
        types: req.query.types ? (req.query.types as string).split(',') : undefined,
        agents: req.query.agents ? (req.query.agents as string).split(',') : undefined,
        impact: req.query.impact ? (req.query.impact as string).split(',') : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const changelog = await changelogService.getChangelog(filters);

      res.json({
        success: true,
        ...changelog
      });

    } catch (error) {
      next(error);
    }
  });

  // Get changelog summary for period
  app.get('/api/changelog/summary/:period', async (req: Request, res: Response, next: Function) => {
    try {
      const { period } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      if (!['daily', 'weekly', 'monthly'].includes(period)) {
        return res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly' });
      }

      const summary = await changelogService.getChangelogSummary(userId, period as any);

      res.json({
        success: true,
        ...summary
      });

    } catch (error) {
      next(error);
    }
  });

  // Track agent activity
  app.post('/api/changelog/agent-activity', async (req: Request, res: Response, next: Function) => {
    try {
      const { agentId, activity, data } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      await changelogService.trackAgentActivity(userId, agentId, activity, data);

      res.json({
        success: true,
        message: 'Agent activity tracked successfully'
      });

    } catch (error) {
      next(error);
    }
  });

  // Generate progress report
  app.get('/api/changelog/progress-report', async (req: Request, res: Response, next: Function) => {
    try {
      const { goalId, period = 'monthly' } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      if (!['weekly', 'monthly'].includes(period as string)) {
        return res.status(400).json({ error: 'Invalid period. Must be weekly or monthly' });
      }

      const report = await changelogService.generateProgressReport(
        userId,
        goalId as string,
        period as any
      );

      res.json({
        success: true,
        ...report
      });

    } catch (error) {
      next(error);
    }
  });

  // Get user streaks
  app.get('/api/changelog/streaks', async (req: Request, res: Response, next: Function) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      // Get user's current streaks
      const db = require('../config/database').getDatabase();
      const result = await db.query(
        'SELECT * FROM user_streaks WHERE user_id = $1 ORDER BY current_streak DESC',
        [userId]
      );

      res.json({
        success: true,
        streaks: result.rows
      });

    } catch (error) {
      next(error);
    }
  });

  // Get milestones
  app.get('/api/changelog/milestones', async (req: Request, res: Response, next: Function) => {
    try {
      const { goalId } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      let sql = 'SELECT * FROM milestones WHERE user_id = $1';
      const params = [userId];

      if (goalId) {
        sql += ' AND goal_id = $2';
        params.push(goalId as string);
      }

      sql += ' ORDER BY achieved_at DESC NULLS LAST';

      const db = require('../config/database').getDatabase();
      const result = await db.query(sql, params);

      res.json({
        success: true,
        milestones: result.rows
      });

    } catch (error) {
      next(error);
    }
  });

  // Get notifications
  app.get('/api/changelog/notifications', async (req: Request, res: Response, next: Function) => {
    try {
      const { unreadOnly = false } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      let sql = 'SELECT * FROM notifications WHERE user_id = $1';
      const params = [userId];

      if (unreadOnly === 'true') {
        sql += ' AND read = false';
      }

      sql += ' ORDER BY created_at DESC';

      const db = require('../config/database').getDatabase();
      const result = await db.query(sql, params);

      res.json({
        success: true,
        notifications: result.rows
      });

    } catch (error) {
      next(error);
    }
  });

  // Mark notification as read
  app.put('/api/changelog/notifications/:notificationId/read', async (req: Request, res: Response, next: Function) => {
    try {
      const { notificationId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const db = require('../config/database').getDatabase();
      await db.query(
        'UPDATE notifications SET read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
        [notificationId, userId]
      );

      res.json({
        success: true,
        message: 'Notification marked as read'
      });

    } catch (error) {
      next(error);
    }
  });

  // Get motivational content
  app.get('/api/changelog/motivation/:category', async (req: Request, res: Response, next: Function) => {
    try {
      const { category } = req.params;

      const db = require('../config/database').getDatabase();
      const result = await db.query(
        'SELECT * FROM motivational_content WHERE category = $1 ORDER BY RANDOM() LIMIT 1',
        [category]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No motivational content found for this category' });
      }

      // Update usage count
      await db.query(
        'UPDATE motivational_content SET usage_count = usage_count + 1 WHERE id = $1',
        [result.rows[0].id]
      );

      res.json({
        success: true,
        content: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  });

  // Get progress analytics
  app.get('/api/changelog/analytics/:metric', async (req: Request, res: Response, next: Function) => {
    try {
      const { metric } = req.params;
      const { period = 'weekly' } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      // Check cache first
      const db = require('../config/database').getDatabase();
      const cacheResult = await db.query(
        'SELECT analytic_data FROM progress_analytics_cache WHERE user_id = $1 AND metric_name = $2 AND time_period = $3 AND expires_at > NOW()',
        [userId, metric, period]
      );

      if (cacheResult.rows.length > 0) {
        return res.json({
          success: true,
          analytics: JSON.parse(cacheResult.rows[0].analytic_data),
          cached: true
        });
      }

      // Generate analytics (placeholder - would implement actual analytics calculation)
      const analytics = {
        metric,
        period,
        value: Math.random() * 100,
        trend: 'increasing',
        insights: ['Sample insight 1', 'Sample insight 2']
      };

      // Cache the result
      await db.query(
        'INSERT INTO progress_analytics_cache (id, user_id, metric_name, time_period, analytic_data, computed_at, expires_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL \'1 day\')',
        [require('crypto').randomUUID(), userId, metric, period, JSON.stringify(analytics)]
      );

      res.json({
        success: true,
        analytics,
        cached: false
      });

    } catch (error) {
      next(error);
    }
  });

  logger.info('Changelog routes configured successfully');
}
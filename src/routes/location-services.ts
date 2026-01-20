import { Request, Response } from 'express';
import { LeadCoordinatorAgent } from '../agents/lead-coordinator';
import { AgentCommunicationHub } from '../communication/agent-hub';
import { logger } from '../utils/logger';

export function setupLocationServices(app: any, leadCoordinator: LeadCoordinatorAgent, communicationHub: AgentCommunicationHub): void {
  // Location-based points of interest
  app.post('/api/location/nearby-places', async (req: Request, res: Response, next: Function) => {
    try {
      const { latitude, longitude, radius = 1000, categories = [] } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const nearbyPlaces = await leadCoordinator.findNearbyPlaces(
        userId,
        latitude,
        longitude,
        radius,
        categories
      );

      res.json({
        success: true,
        nearbyPlaces,
        userLocation: { latitude, longitude },
        searchRadius: radius
      });

    } catch (error) {
      next(error);
    }
  });

  // Area safety analysis
  app.post('/api/location/safety-analysis', async (req: Request, res: Response, next: Function) => {
    try {
      const { latitude, longitude, radius = 500 } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const safetyAnalysis = await leadCoordinator.analyzeAreaSafety(
        userId,
        latitude,
        longitude,
        radius
      );

      res.json({
        success: true,
        safetyAnalysis,
        recommendations: safetyAnalysis.recommendations,
        riskLevel: safetyAnalysis.overallRisk
      });

    } catch (error) {
      next(error);
    }
  });

  // Safe route planning
  app.post('/api/location/safe-route', async (req: Request, res: Response, next: Function) => {
    try {
      const { startLat, startLng, endLat, endLng, preferences = {} } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const safeRoute = await leadCoordinator.planSafeRoute(
        userId,
        { latitude: startLat, longitude: startLng },
        { latitude: endLat, longitude: endLng },
        preferences
      );

      res.json({
        success: true,
        route: safeRoute,
        safetyScore: safeRoute.overallSafetyScore,
        alternatives: safeRoute.alternativeRoutes
      });

    } catch (error) {
      next(error);
    }
  });

  // Location-based recommendations
  app.post('/api/location/recommendations', async (req: Request, res: Response, next: Function) => {
    try {
      const { latitude, longitude, context = 'general' } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const recommendations = await leadCoordinator.getLocationBasedRecommendations(
        userId,
        latitude,
        longitude,
        context
      );

      res.json({
        success: true,
        recommendations,
        context,
        userLocation: { latitude, longitude }
      });

    } catch (error) {
      next(error);
    }
  });

  // Real-time location alerts
  app.post('/api/location/alerts', async (req: Request, res: Response, next: Function) => {
    try {
      const { latitude, longitude, alertTypes = [] } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const alerts = await leadCoordinator.checkLocationAlerts(
        userId,
        latitude,
        longitude,
        alertTypes
      );

      res.json({
        success: true,
        alerts,
        hasActiveAlerts: alerts.length > 0
      });

    } catch (error) {
      next(error);
    }
  });

  // Update user location preferences
  app.put('/api/location/preferences', async (req: Request, res: Response, next: Function) => {
    try {
      const { preferences } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      await leadCoordinator.updateLocationPreferences(userId, preferences);

      res.json({
        success: true,
        message: 'Location preferences updated successfully'
      });

    } catch (error) {
      next(error);
    }
  });

  // Get location-based insights for agents
  app.get('/api/location/insights/:agentType', async (req: Request, res: Response, next: Function) => {
    try {
      const { agentType } = req.params;
      const { latitude, longitude } = req.query;
      const userId = (req as any).user?.id;

      if (!userId || !latitude || !longitude) {
        return res.status(400).json({ 
          error: 'Missing required parameters: userId, latitude, longitude' 
        });
      }

      const insights = await communicationHub.sendMessage(
        'lead-coordinator',
        agentType,
        {
          userId,
          type: 'location-insights',
          location: { 
            latitude: parseFloat(latitude as string), 
            longitude: parseFloat(longitude as string) 
          },
          context: 'agent-coordination'
        }
      );

      res.json({
        success: true,
        agentType,
        insights,
        location: { latitude, longitude }
      });

    } catch (error) {
      next(error);
    }
  });

  logger.info('Location services routes configured successfully');
}
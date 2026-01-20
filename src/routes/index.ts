import { Request, Response } from 'express';
import { LeadCoordinatorAgent } from '../agents/lead-coordinator';
import { AgentCommunicationHub } from '../communication/agent-hub';
import { setupReceiptRoutes } from './receipts';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

export function setupRoutes(
  app: Express,
  leadCoordinator: LeadCoordinatorAgent,
  communicationHub: AgentCommunicationHub
): void {
  // Setup location-based services routes
  setupLocationServices(app, leadCoordinator, communicationHub);
  
  // Setup changelog and progress tracking routes
  setupChangelogRoutes(app);
  
  // Setup receipt scanning and spending analysis routes
  setupReceiptRoutes(app, leadCoordinator, communicationHub);
}
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { LeadCoordinatorAgent } from './agents/lead-coordinator';
import { AgentCommunicationHub } from './communication/agent-hub';
import { setupRoutes } from './routes';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize core components
let leadCoordinator: LeadCoordinatorAgent;
let communicationHub: AgentCommunicationHub;

async function initializeApp() {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();
    
    // Initialize agent communication hub
    communicationHub = new AgentCommunicationHub();
    await communicationHub.initialize();
    
    // Initialize lead coordinator
    leadCoordinator = new LeadCoordinatorAgent(communicationHub);
    await leadCoordinator.initialize();
    
    // Setup routes
    setupRoutes(app, leadCoordinator, communicationHub);
    
    // Error handling
    app.use(errorHandler);
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`Life Coach App server running on port ${PORT}`);
    });
    
    // Setup Socket.IO for real-time communication
    setupSocketIO();
    
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

function setupSocketIO() {
  io.use(authMiddleware);
  
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user?.id}`);
    
    // Join user-specific room
    socket.join(`user-${socket.user?.id}`);
    
    // Handle agent messages
    socket.on('agent-message', async (data) => {
      try {
        const { agentType, message, goalId } = data;
        const response = await leadCoordinator.processUserMessage(
          socket.user?.id,
          agentType,
          message,
          goalId
        );
        
        socket.emit('agent-response', response);
      } catch (error) {
        logger.error('Error processing agent message:', error);
        socket.emit('error', { message: 'Failed to process message' });
      }
    });
    
    // Handle progress updates
    socket.on('progress-update', async (data) => {
      try {
        const { goalId, agentId, type, value, notes } = data;
        await leadCoordinator.recordProgress(
          socket.user?.id,
          goalId,
          agentId,
          type,
          value,
          notes
        );
        
        // Broadcast to user's other devices
        socket.to(`user-${socket.user?.id}`).emit('progress-updated', data);
      } catch (error) {
        logger.error('Error recording progress:', error);
        socket.emit('error', { message: 'Failed to record progress' });
      }
    });
    
    // Handle receipt uploads
    socket.on('receipt-upload', async (data) => {
      try {
        const { imageData } = data;
        const result = await leadCoordinator.processReceipt(
          socket.user?.id,
          imageData
        );
        
        socket.emit('receipt-processed', result);
      } catch (error) {
        logger.error('Error processing receipt:', error);
        socket.emit('error', { message: 'Failed to process receipt' });
      }
    });
    
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.user?.id}`);
    });
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start the application
initializeApp().catch((error) => {
  logger.error('Application startup failed:', error);
  process.exit(1);
});

export { app, io, leadCoordinator, communicationHub };
import { Request, Response } from 'express';
import { LeadCoordinatorAgent } from '../agents/lead-coordinator';
import { AgentCommunicationHub } from '../communication/agent-hub';
import { ReceiptScanningService } from '../services/receipt-scanning';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and HEIC images are allowed.'), false);
    }
  }
});

export function setupReceiptRoutes(
  app: Express,
  leadCoordinator: LeadCoordinatorAgent,
  communicationHub: AgentCommunicationHub
): void {
  const receiptScanningService = new ReceiptScanningService();

  // Upload and process receipt image
  app.post('/api/receipts/upload', upload.single('receipt'), async (req: Request, res: Response, next: Function) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No receipt image provided' });
      }

      const imageData = req.file.buffer.toString('base64');
      
      // Process receipt with AI and OCR
      const result = await receiptScanningService.processReceiptUpload(
        userId,
        imageData,
        {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadTime: new Date()
        }
      );

      res.json({
        success: true,
        jobId: result.jobId,
        message: 'Receipt upload received and processing started',
        estimatedProcessingTime: result.estimatedTime
      });

    } catch (error) {
      next(error);
    }
  });

  // Upload receipt via base64 string
  app.post('/api/receipts/upload-base64', async (req: Request, res: Response, next: Function) => {
    try {
      const { imageData, options = {} } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      if (!imageData) {
        return res.status(400).json({ error: 'No image data provided' });
      }

      // Process receipt
      const result = await receiptScanningService.processReceiptUpload(userId, imageData, options);

      res.json({
        success: true,
        jobId: result.jobId,
        message: 'Receipt processing started',
        estimatedProcessingTime: result.estimatedTime
      });

    } catch (error) {
      next(error);
    }
  });

  // Get receipt processing status
  app.get('/api/receipts/status/:jobId', async (req: Request, res: Response, next: Function) => {
    try {
      const { jobId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      // Check cached result
      const result = await receiptScanningService.getProcessingResult(jobId);

      if (result) {
        res.json({
          success: true,
          status: 'completed',
          receipt: result.receipt,
          analysis: result.analysis,
          processingTime: result.processingTime
        });
      } else {
        // Check queue status (simplified)
        res.json({
          success: true,
          status: 'processing',
          message: 'Receipt is still being processed',
          estimatedTimeRemaining: '30 seconds'
        });
      }

    } catch (error) {
      next(error);
    }
  });

  // Get user's receipts with filtering
  app.get('/api/receipts', async (req: Request, res: Response, next: Function) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const {
        page = 1,
        limit = 20,
        category,
        merchant,
        dateFrom,
        dateTo,
        minAmount,
        maxAmount,
        sortBy = 'date',
        sortOrder = 'desc'
      } = req.query;

      // Build query parameters
      const filters = {
        userId,
        category,
        merchant,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        minAmount: minAmount ? parseFloat(minAmount as string) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount as string) : undefined,
        page: parseInt(page as string) || 1,
        limit: Math.min(parseInt(limit as string) || 20, 100),
        sortBy: sortBy as string,
        sortOrder: sortOrder as string
      };

      const result = await receiptScanningService.getUserReceipts(filters);

      res.json({
        success: true,
        receipts: result.receipts,
        pagination: result.pagination,
        filters,
        summary: result.summary
      });

    } catch (error) {
      next(error);
    }
  });

  // Get receipt details by ID
  app.get('/api/receipts/:receiptId', async (req: Request, res: Response, next: Function) => {
    try {
      const { receiptId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const receipt = await receiptScanningService.getReceiptById(receiptId, userId);

      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      res.json({
        success: true,
        receipt
      });

    } catch (error) {
      next(error);
    }
  });

  // Update receipt (manual corrections)
  app.put('/api/receipts/:receiptId', async (req: Request, res: Response, next: Function) => {
    try {
      const { receiptId } = req.params;
      const { merchant, amount, category, items, date } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const updateData = {
        merchant,
        amount,
        category,
        items,
        date: date ? new Date(date) : undefined
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const updatedReceipt = await receiptScanningService.updateReceipt(receiptId, userId, updateData);

      if (!updatedReceipt) {
        return res.status(404).json({ error: 'Receipt not found or unauthorized' });
      }

      res.json({
        success: true,
        receipt: updatedReceipt,
        message: 'Receipt updated successfully'
      });

    } catch (error) {
      next(error);
    }
  });

  // Delete receipt
  app.delete('/api/receipts/:receiptId', async (req: Request, res: Response, next: Function) => {
    try {
      const { receiptId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const deleted = await receiptScanningService.deleteReceipt(receiptId, userId);

      if (!deleted) {
        return res.status(404).json({ error: 'Receipt not found or unauthorized' });
      }

      res.json({
        success: true,
        message: 'Receipt deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  });

  // Get spending analytics
  app.get('/api/receipts/analytics', async (req: Request, res: Response, next: Function) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const {
        period = 'monthly',
        category,
        dateFrom,
        dateTo
      } = req.query;

      const analytics = await receiptScanningService.getSpendingAnalytics(userId, {
        period: period as string,
        category: category as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined
      });

      res.json({
        success: true,
        analytics,
        period,
        generatedAt: new Date()
      });

    } catch (error) {
      next(error);
    }
  });

  // Get category breakdown
  app.get('/api/receipts/categories', async (req: Request, res: Response, next: Function) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const { period = 'monthly' } = req.query;
      
      const categoryBreakdown = await receiptScanningService.getCategoryBreakdown(userId, period as string);

      res.json({
        success: true,
        categories: categoryBreakdown.categories,
        total: categoryBreakdown.total,
        period,
        insights: categoryBreakdown.insights
      });

    } catch (error) {
      next(error);
    }
  });

  // Get merchant breakdown
  app.get('/api/receipts/merchants', async (req: Request, res: Response, next: Function) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const { period = 'monthly', limit = 10 } = req.query;
      
      const merchantBreakdown = await receiptScanningService.getMerchantBreakdown(
        userId, 
        period as string, 
        parseInt(limit as string) || 10
      );

      res.json({
        success: true,
        merchants: merchantBreakdown.merchants,
        totalMerchants: merchantBreakdown.total,
        period,
        insights: merchantBreakdown.insights
      });

    } catch (error) {
      next(error);
    }
  });

  // Bulk upload multiple receipts
  app.post('/api/receipts/bulk-upload', upload.array('receipts', 10), async (req: Request, res: Response, next: Function) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      if (!req.files || !Array.isArray(req.files)) {
        return res.status(400).json({ error: 'No receipt images provided' });
      }

      const files = req.files as Express.Multer.File[];
      const results = [];

      for (const file of files) {
        try {
          const imageData = file.buffer.toString('base64');
          const result = await receiptScanningService.processReceiptUpload(
            userId,
            imageData,
            {
              fileName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
              uploadTime: new Date(),
              bulkUpload: true
            }
          );

          results.push({
            fileName: file.originalname,
            jobId: result.jobId,
            status: 'queued'
          });

        } catch (error) {
          results.push({
            fileName: file.originalname,
            error: error.message,
            status: 'error'
          });
        }
      }

      res.json({
        success: true,
        results,
        totalFiles: files.length,
        message: `Started processing ${files.length} receipts`
      });

    } catch (error) {
      next(error);
    }
  });

  // Get receipt image for verification
  app.get('/api/receipts/:receiptId/image', async (req: Request, res: Response, next: Function) => {
    try {
      const { receiptId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const receipt = await receiptScanningService.getReceiptById(receiptId, userId);

      if (!receipt || !receipt.imageUrl) {
        return res.status(404).json({ error: 'Receipt image not found' });
      }

      // Return the image
      const imageData = Buffer.from(receipt.imageUrl, 'base64');
      
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': imageData.length.toString(),
        'Cache-Control': 'public, max-age=86400' // Cache for 1 day
      });

      res.send(imageData);

    } catch (error) {
      next(error);
    }
  });

  // Retry failed receipt processing
  app.post('/api/receipts/:receiptId/retry', async (req: Request, res: Response, next: Function) => {
    try {
      const { receiptId } = req.params;
      const { options = {} } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      // Get original receipt data
      const originalReceipt = await receiptScanningService.getReceiptById(receiptId, userId);

      if (!originalReceipt) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      // Re-process with enhanced options
      const result = await receiptScanningService.retryProcessing(receiptId, userId, originalReceipt, options);

      res.json({
        success: true,
        jobId: result.jobId,
        message: 'Receipt re-processing started',
        estimatedProcessingTime: result.estimatedTime
      });

    } catch (error) {
      next(error);
    }
  });

  logger.info('Receipt scanning routes configured successfully');
}
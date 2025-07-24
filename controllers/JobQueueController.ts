import { Router } from 'express'
import type { Request, Response } from 'express'
import { jobQueueService } from '../services/JobQueueService'
import { AuthMiddleware } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

const getQueueStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await jobQueueService.getQueueStats()
    res.json({
      success: true,
      data: {
        queue: 'user-monitoring',
        stats,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get queue stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

const triggerNewUserCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await jobQueueService.triggerNewUserCheck()
    res.json({
      success: true,
      message: 'New user check job triggered',
      data: {
        jobId: job.id,
        jobName: job.name
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger new user check',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

const triggerPaidUserCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await jobQueueService.triggerPaidUserCheck()
    res.json({
      success: true,
      message: 'Paid user check job triggered',
      data: {
        jobId: job.id,
        jobName: job.name
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger paid user check',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

const triggerInactiveUserCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await jobQueueService.triggerInactiveUserCheck()
    res.json({
      success: true,
      message: 'Inactive user check job triggered',
      data: {
        jobId: job.id,
        jobName: job.name
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger inactive user check',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

const triggerTestJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await jobQueueService.triggerTestJob()
    res.json({
      success: true,
      message: 'Test job triggered',
      data: {
        jobId: job.id,
        jobName: job.name
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger test job',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Protected routes - require authentication
router.get('/stats', AuthMiddleware.authenticateToken, asyncHandler(getQueueStats))
router.post('/trigger/new-users', AuthMiddleware.authenticateToken, asyncHandler(triggerNewUserCheck))
router.post('/trigger/paid-users', AuthMiddleware.authenticateToken, asyncHandler(triggerPaidUserCheck))
router.post('/trigger/inactive-users', AuthMiddleware.authenticateToken, asyncHandler(triggerInactiveUserCheck))
router.post('/trigger/test', AuthMiddleware.authenticateToken, asyncHandler(triggerTestJob))

export const JobQueueController = {
  router,
  getQueueStats,
  triggerNewUserCheck,
  triggerPaidUserCheck,
  triggerInactiveUserCheck,
  triggerTestJob,
} 
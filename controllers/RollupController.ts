import { Router } from 'express'
import type { Request, Response } from 'express'
import { RollupService } from '../services/RollupService.js'
import { AuthMiddleware } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

const updateActivity = async (req: Request, res: Response): Promise<void> => {
  const activity = await RollupService.updateActivity(req)
  res.json({
    success: true,
    data: activity,
    message: 'Activity updated successfully'
  })
}

// Initialize routes with authentication middleware and async error handling
router.post('/update', AuthMiddleware.authenticateToken, asyncHandler(updateActivity))

export const RollupController = {
  router,
  updateActivity
} 
import { Router } from 'express'
import type { Request, Response } from 'express'
import { UserProfileService } from '../services/UserProfileService.js'
import { AuthMiddleware } from '../middleware/auth.js'
import { asyncHandler, ApiError } from '../middleware/errorHandler.js'

const router = Router()

const getStatusCounts = async (req: Request, res: Response): Promise<void> => {
  const statusCounts = await UserProfileService.getUserStatusCounts()
  res.json({
    success: true,
    data: statusCounts
  })
}



// Initialize routes with authentication middleware and async error handling
router.get('/status-counts', AuthMiddleware.authenticateToken, asyncHandler(getStatusCounts))

export const UserController = {
  router,
  getStatusCounts,
} 

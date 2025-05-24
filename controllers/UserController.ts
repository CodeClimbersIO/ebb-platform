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

// Test endpoint to demonstrate error handling
const testError = async (req: Request, res: Response): Promise<void> => {
  const errorType = req.query.type as string
  
  switch (errorType) {
    case 'api':
      throw new ApiError('This is a test API error', 400)
    case 'generic':
      throw new Error('This is a generic error')
    case 'async':
      // Simulate an async operation that fails
      await new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Async operation failed')), 100)
      })
      break
    default:
      res.json({ message: 'Test endpoint - add ?type=api|generic|async to test error handling' })
  }
}

// Initialize routes with authentication middleware and async error handling
router.get('/status-counts', AuthMiddleware.authenticateToken, asyncHandler(getStatusCounts))
router.get('/test-error', asyncHandler(testError))

export const UserController = {
  router,
  getStatusCounts,
  testError
} 

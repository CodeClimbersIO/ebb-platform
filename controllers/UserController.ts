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

const saveUserLocation = async (req: Request, res: Response): Promise<void> => {
  const userLocation = await UserProfileService.saveUserLocation(req)
  res.json({
    success: true,
    data: userLocation
  })
}

const getUserLocations = async (req: Request, res: Response): Promise<void> => {
  const userLocations = await UserProfileService.getUserLocations()
  res.json({
    success: true,
    data: userLocations
  })
}

const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }
  const userProfile = await UserProfileService.getUserProfile(req.user.id)
  res.json({
    success: true,
    data: userProfile
  })
}

router.get('/status-counts', AuthMiddleware.authenticateToken, asyncHandler(getStatusCounts))
router.post('/location', AuthMiddleware.authenticateToken, asyncHandler(saveUserLocation))
router.get('/locations', AuthMiddleware.authenticateToken, asyncHandler(getUserLocations))
router.get('/profile/me', AuthMiddleware.authenticateToken, asyncHandler(getUserProfile))

export const UserController = {
  router,
  getStatusCounts,
  saveUserLocation
} 

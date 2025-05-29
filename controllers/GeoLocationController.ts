import { Router } from 'express'
import type { Request, Response } from 'express'
import { GeoLocationService } from '../services/GeoLocationService.js'
import { AuthMiddleware } from '../middleware/auth.js'
import { asyncHandler, ApiError } from '../middleware/errorHandler.js'

const router = Router()

const getLocationByIP = async (req: Request, res: Response): Promise<void> => {
  const { ip } = req.params

  if (!ip) {
    throw new ApiError('IP address is required', 400)
  }

  const locationData = await GeoLocationService.getLocationByIP(ip)
  res.json({
    success: true,
    data: locationData
  })
}

// Initialize routes with authentication middleware and async error handling
router.get('/ip/:ip', AuthMiddleware.authenticateToken, asyncHandler(getLocationByIP))

export const GeoLocationController = {
  router,
  getLocationByIP,
} 
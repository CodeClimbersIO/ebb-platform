import { Router } from 'express'
import type { Request, Response } from 'express'
import { GeoLocationService } from '../services/GeoLocationService'
import { AuthMiddleware } from '../middleware/auth'
import { asyncHandler, ApiError } from '../middleware/errorHandler'

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

const getCurrentLocation = async (req: Request, res: Response): Promise<void> => {
  const clientIP = GeoLocationService.getClientIP(req)
  
  if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.startsWith('192.168.') || clientIP.startsWith('10.') || clientIP.startsWith('172.')) {
    throw new ApiError('Cannot geolocate private/localhost IP addresses', 400)
  }

  const locationData = await GeoLocationService.getLocationByIP(clientIP)
  res.json({
    success: true,
    data: {
      ...locationData,
      detectedIP: clientIP
    }
  })
}

// Initialize routes with authentication middleware and async error handling
router.get('/ip/:ip', AuthMiddleware.authenticateToken, asyncHandler(getLocationByIP))
router.get('/current', AuthMiddleware.authenticateToken, asyncHandler(getCurrentLocation))

export const GeoLocationController = {
  router,
  getLocationByIP,
  getCurrentLocation,
} 
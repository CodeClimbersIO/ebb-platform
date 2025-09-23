import { Router } from 'express'
import type { Request, Response } from 'express'
import { StripeService } from '../services/StripeService.js'
import { AuthMiddleware } from '../middleware/auth.js'
import { asyncHandler, ApiError } from '../middleware/errorHandler.js'
import { getProductConfig } from '../config/products.js'
import { LicenseService } from '../services/LicenseService.js'

const router = Router()

const createCheckout = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const { licenseType } = req.body

  if(!licenseType) {
    throw new ApiError('licenseType is required', 422)
  }

  const productConfig = getProductConfig(licenseType)

  if (!productConfig) {
    throw new ApiError(`Invalid licenseType: ${licenseType}`, 422)
  }

  const existingLicense = await LicenseService.getActiveLicense(req.user.id)
  if (existingLicense && existingLicense.license_type !== 'free_trial') {
    throw new ApiError('User already has an active license', 422)
  }

  const checkoutUrl = await StripeService.createCheckoutSession({
    userId: req.user.id,
    userEmail: req.user.email,
    productConfig
  })

  res.json({
    success: true,
    data: { url: checkoutUrl }
  })
}

router.post('/create', AuthMiddleware.authenticateToken, asyncHandler(createCheckout))

export const CheckoutController = {
  router,
  createCheckout
}
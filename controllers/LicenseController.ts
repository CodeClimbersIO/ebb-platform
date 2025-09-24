import { Router } from 'express'
import type { Request, Response } from 'express'
import { StripeService } from '../services/StripeService.js'
import { LicenseService } from '../services/LicenseService.js'
import { AuthMiddleware } from '../middleware/auth.js'
import { asyncHandler, ApiError } from '../middleware/errorHandler.js'

const router = Router()

const cancelLicense = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  try {
    // Get user's active license to find subscription ID
    const activeLicense = await LicenseService.getActiveLicense(req.user.id)
    
    if (!activeLicense) {
      throw new ApiError('No active license found', 404)
    }

    if (!activeLicense.stripe_payment_id) {
      throw new ApiError('No Stripe subscription ID found for license', 400)
    }

    // Cancel the subscription in Stripe
    const canceledSubscription = await StripeService.cancelSubscription(activeLicense.stripe_payment_id)

    res.json({
      success: true,
      message: 'License cancellation scheduled at period end',
      data: {
        license_id: activeLicense.id,
        stripe_subscription_id: canceledSubscription.id,
        canceled_at: canceledSubscription.canceled_at,
        cancel_at_period_end: canceledSubscription.cancel_at_period_end
      }
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    console.error('Error canceling license:', error)
    throw new ApiError('Failed to cancel license', 500)
  }
}

const startTrial = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  await LicenseService.startFreeTrial(req.user.id)

  res.json({
    success: true,
    message: 'Free trial started successfully'
  })
}

router.post('/cancel', AuthMiddleware.authenticateToken, asyncHandler(cancelLicense))
router.post('/start-trial', AuthMiddleware.authenticateToken, asyncHandler(startTrial))

export const LicenseController = {
  router,
  cancelLicense,
  startTrial
}
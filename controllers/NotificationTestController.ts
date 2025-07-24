import { Router } from 'express'
import type { Request, Response } from 'express'
import { NotificationEngine } from '../services/NotificationEngine'
import { getNotificationConfig } from '../config/notifications'
import { AuthMiddleware } from '../middleware/auth'
import { asyncHandler, ApiError } from '../middleware/errorHandler'
import type { PaidUserRecord, NewUserRecord, InactiveUserRecord } from '../types/jobs'

const router = Router()

const testDiscordNotification = async (req: Request, res: Response): Promise<void> => {
  const { type = 'paid_user', userEmail = 'test@example.com' } = req.body

  if (!['paid_user', 'new_user', 'inactive_user'].includes(type)) {
    throw new ApiError('Invalid notification type. Must be: paid_user, new_user, or inactive_user', 400)
  }

  try {
    const config = getNotificationConfig()
    
    if (!config.channels.discord.enabled || !config.channels.discord.webhookUrl) {
      throw new ApiError('Discord notifications are not configured. Please set DISCORD_WEBHOOK_URL environment variable.', 400)
    }

    const notificationEngine = new NotificationEngine(config)

    // Create test user data based on notification type
    let testUser: PaidUserRecord | NewUserRecord | InactiveUserRecord
    let notificationResults

    switch (type) {
      case 'paid_user':
        testUser = {
          id: 'test-user-123',
          email: userEmail,
          subscription_status: 'premium',
          paid_at: new Date(),
          license_id: 'license_test_123',
          stripe_payment_id: 'pi_test_123456789',
          stripe_customer_id: 'cus_test_123456789'
        } as PaidUserRecord

        notificationResults = await notificationEngine.sendPaidUserNotifications(testUser, ['discord'])
        break

      case 'new_user':
        testUser = {
          id: 'test-user-456',
          email: userEmail,
          created_at: new Date()
        } as NewUserRecord

        notificationResults = await notificationEngine.sendNewUserNotifications(testUser, ['discord'])
        break

      case 'inactive_user':
        testUser = {
          id: 'test-user-789',
          email: userEmail,
          last_activity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          days_inactive: 7
        } as InactiveUserRecord

        notificationResults = await notificationEngine.sendInactiveUserNotifications(testUser, ['discord'])
        break

      default:
        throw new ApiError('Unsupported notification type', 400)
    }

    const successCount = notificationResults.filter(r => r.success).length
    const failCount = notificationResults.filter(r => !r.success).length

    res.json({
      success: true,
      message: `Test ${type} notification sent to Discord`,
      data: {
        type,
        userEmail,
        results: notificationResults,
        summary: {
          sent: successCount,
          failed: failCount
        }
      }
    })
  } catch (error) {
    console.error('Test notification failed:', error)
    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to send test notification',
      500
    )
  }
}

// Routes
router.post('/test', AuthMiddleware.authenticateToken, asyncHandler(testDiscordNotification))

export const NotificationTestController = {
  router,
  testDiscordNotification
}
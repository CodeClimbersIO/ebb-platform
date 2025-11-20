import { NotificationEngine } from './NotificationEngine'
import { getNotificationConfig } from '../config/notifications'
import type { NotificationPayload, BaseUserRecord } from '../types/notifications'

interface FriendRequestEmailData {
  toEmail: string
  fromEmail: string
  requestId: string
  existingUser?: boolean
}

const getNotificationEngine = (): NotificationEngine => {
  const config = getNotificationConfig()
  return new NotificationEngine(config)
}

const sendFriendRequestEmail = async (data: FriendRequestEmailData): Promise<void> => {
  try {
    const notificationEngine = getNotificationEngine()

    const payload: NotificationPayload = {
      type: 'friend_request',
      user: {
        id: data.requestId, // Use request ID as the user ID for tracking
        email: data.toEmail
      } as BaseUserRecord,
      referenceId: `friend_request_${data.requestId}`,
      data: {
        fromEmail: data.fromEmail,
        requestId: data.requestId,
        existingUser: data.existingUser
      }
    }

    const results = await notificationEngine.sendNotification(payload, ['email'])

    const success = results.some(r => r.success)
    if (success) {
      console.log('✅ Friend request email sent successfully via NotificationEngine')
    } else {
      console.error('❌ Failed to send friend request email:', results[0]?.error)
    }
  } catch (error) {
    console.error('❌ Failed to send friend request email:', error)
    // Don't throw here - we don't want email failures to prevent other operations
  }
}

export const EmailService = {
  sendFriendRequestEmail
}
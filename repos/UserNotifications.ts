import { getDb } from '../config/database'
import type { ChannelNotificationRecord, NotificationChannel, NotificationType } from '../types/notifications'

const db = getDb()
export interface UserNotification {
  id: string
  user_id: string
  notification_type: 'paid_user' | 'new_user' | 'inactive_user' | 'weekly_report'
  reference_id: string // Unique identifier for this notification instance
  sent_at: Date
  data?: any // Store additional notification data if needed
  // New fields for multi-channel support
  channel?: string // notification channel (discord, email, etc.)
  provider_result?: any // result from the notification provider
}

const tableName = 'user_notification'

/**
 * Check if we've already sent a specific notification instance to this user
 */
const hasNotificationBeenSent = async (userId: string, notificationType: string, referenceId: string): Promise<boolean> => {
  try {
    const result = await db(tableName)
      .where('user_id', userId)
      .where('notification_type', notificationType)
      .where('reference_id', referenceId)
      .first()

    return !!result
  } catch (error) {
    console.error('Error checking notification status:', error)
    // If table doesn't exist yet, assume notification hasn't been sent
    return false
  }
}

/**
 * Check if we've already sent a specific notification to this user via a specific channel
 */
const hasChannelNotificationBeenSent = async (
  userId: string, 
  notificationType: NotificationType, 
  referenceId: string, 
  channel: NotificationChannel
): Promise<boolean> => {
  try {
    const result = await db(tableName)
      .where('user_id', userId)
      .where('notification_type', notificationType)
      .where('reference_id', referenceId)
      .where('channel', channel)
      .first()

    return !!result
  } catch (error) {
    console.error('Error checking channel notification status:', error)
    // If table doesn't exist yet, assume notification hasn't been sent
    return false
  }
}

/**
 * Record that we've sent a notification to this user
 */
const recordNotificationSent = async (
  userId: string, 
  notificationType: string, 
  referenceId: string,
  data?: any
): Promise<UserNotification> => {
  try {
    const [notification] = await db(tableName)
      .insert({
        user_id: userId,
        notification_type: notificationType,
        reference_id: referenceId,
        sent_at: new Date(),
        data: data ? JSON.stringify(data) : null
      })
      .returning('*')

    return notification
  } catch (error) {
    console.error('Error recording notification:', error)
    throw new Error('Failed to record notification')
  }
}

/**
 * Record that we've sent a notification to this user via a specific channel
 */
const recordChannelNotification = async (
  userId: string,
  notificationType: NotificationType,
  referenceId: string,
  channel: NotificationChannel,
  providerResult?: any,
  data?: any
): Promise<ChannelNotificationRecord> => {
  try {
    const [notification] = await db(tableName)
      .insert({
        user_id: userId,
        notification_type: notificationType,
        reference_id: referenceId,
        channel: channel,
        sent_at: new Date(),
        provider_result: providerResult ? JSON.stringify(providerResult) : null,
        data: data ? JSON.stringify(data) : null
      })
      .returning('*')

    return notification as ChannelNotificationRecord
  } catch (error) {
    console.error('Error recording channel notification:', error)
    throw new Error('Failed to record channel notification')
  }
}

/**
 * Check which users haven't been notified for specific notification instances
 * Takes a map of userId -> referenceId to check for specific notification instances
 */
const filterUnnotifiedUsersByReference = async (
  userNotificationMap: { [userId: string]: string }, 
  notificationType: string
): Promise<string[]> => {
  try {
    const userIds = Object.keys(userNotificationMap)
    if (userIds.length === 0) return []

    // Build OR conditions for each user/reference combination
    const orConditions = userIds.map(userId => ({
      user_id: userId,
      reference_id: userNotificationMap[userId]
    }))

    const notifiedUsers = await db(tableName)
      .select('user_id')
      .where('notification_type', notificationType)
      .where(builder => {
        orConditions.forEach(condition => {
          builder.orWhere(subBuilder => {
            subBuilder.where('user_id', condition.user_id)
                    .andWhere('reference_id', condition.reference_id)
          })
        })
      })

    const notifiedUserIds = notifiedUsers.map(row => row.user_id)
    return userIds.filter(userId => !notifiedUserIds.includes(userId))
  } catch (error) {
    console.error('Error filtering unnotified users by reference:', error)
    // If table doesn't exist, return all users as unnotified
    return Object.keys(userNotificationMap)
  }
}

/**
 * Check which users haven't been notified via a specific channel for specific notification instances
 */
const filterUnnotifiedUsersByChannelReference = async (
  userNotificationMap: { [userId: string]: string },
  notificationType: NotificationType,
  channel: NotificationChannel
): Promise<string[]> => {
  try {
    const userIds = Object.keys(userNotificationMap)
    if (userIds.length === 0) return []

    // Build OR conditions for each user/reference/channel combination
    const orConditions = userIds.map(userId => ({
      user_id: userId,
      reference_id: userNotificationMap[userId],
      channel: channel
    }))

    const notifiedUsers = await db(tableName)
      .select('user_id')
      .where('notification_type', notificationType)
      .where('channel', channel)
      .where(builder => {
        orConditions.forEach(condition => {
          builder.orWhere(subBuilder => {
            subBuilder.where('user_id', condition.user_id)
                    .andWhere('reference_id', condition.reference_id)
          })
        })
      })

    const notifiedUserIds = notifiedUsers.map(row => row.user_id)
    return userIds.filter(userId => !notifiedUserIds.includes(userId))
  } catch (error) {
    console.error('Error filtering unnotified users by channel reference:', error)
    // If table doesn't exist, return all users as unnotified
    return Object.keys(userNotificationMap)
  }
}

export const UserNotificationsRepo = {
  hasNotificationBeenSent,
  hasChannelNotificationBeenSent,
  recordNotificationSent,
  recordChannelNotification,
  filterUnnotifiedUsersByReference,
  filterUnnotifiedUsersByChannelReference,
} 
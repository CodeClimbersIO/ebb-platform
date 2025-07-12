import { Job } from 'bullmq'
import { UserMonitoringRepo } from '../repos/UserMonitoring'
import { UserNotificationsRepo } from '../repos/UserNotifications'
import { NotificationService } from './NotificationService'
import { NotificationEngine } from './NotificationEngine'
import { getNotificationConfig } from '../config/notifications'
import type { 
  NewUserCheckJobData, 
  PaidUserCheckJobData, 
  InactiveUserCheckJobData,
  TestJobData,
  JobResult,
  PaidUserRecord,
  NewUserRecord,
  InactiveUserRecord
} from '../types/jobs'
import type { NotificationChannel } from '../types/notifications'

/**
 * Process job to check for new users (runs every 10 minutes)
 * Implements idempotent notifications - only sends notification once per user per channel
 */
export const processNewUserCheck = async (job: Job<NewUserCheckJobData>): Promise<JobResult> => {
  try {
    console.log('🔍 Processing new user check job...')
    
    // Get users who signed up in the last 10 minutes
    const newUsers = await UserMonitoringRepo.getNewUsers(10)
    console.log(`📊 Found ${newUsers.length} new users`)
    
    // Use generic idempotent notification processing
    const results = await processNotificationsWithIdempotency(
      newUsers,
      'new_user',
      (user) => `new_${user.id}_${user.created_at.getTime()}`,
      '👋'
    )
    
    console.log(`✅ New user check completed - ${results.newNotifications} notifications sent, ${results.failedNotifications} failed`)
    console.log(`📊 Channel breakdown:`, results.channelResults)
    
    const targetChannels = getNotificationEngine().getConfig().events.new_user
    
    return {
      success: true,
      message: `New user check completed - sent ${results.newNotifications} notifications across ${targetChannels.length} channels`,
      data: results,
      processedAt: new Date()
    }
  } catch (error) {
    console.error('❌ Error processing new user check:', error)
    return {
      success: false,
      message: `Failed to check new users: ${error}`,
      processedAt: new Date()
    }
  }
}

// Initialize notification engine with centralized configuration
const getNotificationEngine = (): NotificationEngine => {
  const config = getNotificationConfig()
  return new NotificationEngine(config)
}

/**
 * Generic function to process notifications with idempotency for any notification type
 * Exported for testing purposes
 */
export const processNotificationsWithIdempotency = async <T extends PaidUserRecord | NewUserRecord | InactiveUserRecord>(
  users: T[],
  notificationType: 'paid_user' | 'new_user' | 'inactive_user',
  generateReferenceId: (user: T) => string,
  logPrefix: string
): Promise<{
  totalFound: number
  newNotifications: number
  failedNotifications: number
  channelResults: { [channel: string]: any }
}> => {
  if (users.length === 0) {
    console.log(`✅ No new ${notificationType} users to notify`)
    return {
      totalFound: 0,
      newNotifications: 0,
      failedNotifications: 0,
      channelResults: {}
    }
  }
  
  // Initialize notification engine
  const notificationEngine = getNotificationEngine()
  const targetChannels = notificationEngine.getConfig().events[notificationType]
  
  // Create a map of user ID to reference ID for idempotency checking
  const userNotificationMap: { [userId: string]: string } = {}
  users.forEach(user => {
    userNotificationMap[user.id] = generateReferenceId(user)
  })
  
  // For each channel, filter out users we've already notified (per-channel idempotency)
  const channelResults: { [channel: string]: any } = {}
  let totalNotificationsSent = 0
  let totalNotificationsFailed = 0
  
  for (const channel of targetChannels) {
    console.log(`${logPrefix} Processing ${channel} notifications...`)
    
    // Filter out users already notified via this specific channel
    const unnotifiedUserIds = await UserNotificationsRepo.filterUnnotifiedUsersByChannelReference(
      userNotificationMap, 
      notificationType,
      channel
    )
    
    // Get the user objects for unnotified users
    const usersToNotify = users.filter(user => unnotifiedUserIds.includes(user.id))
    
    console.log(`${logPrefix} Sending ${channel} notifications to ${usersToNotify.length} users (${users.length - usersToNotify.length} already notified via ${channel})`)
    
    if (usersToNotify.length > 0) {
      // Send notifications for users via this channel
      const notificationResults = await notificationEngine.sendBatchNotifications(
        usersToNotify, 
        notificationType,
        [channel]
      )
      
      // Record notifications in database to ensure per-channel idempotency
      const recordingPromises = notificationResults
        .filter(result => result.success)
        .map(result => 
          UserNotificationsRepo.recordChannelNotification(
            result.userId, 
            notificationType,
            result.referenceId,
            result.channel as NotificationChannel,
            result,
            { 
              notificationId: result.notificationId,
              sentAt: result.timestamp.toISOString()
            }
          )
        )
      
      await Promise.all(recordingPromises)
      
      const successCount = notificationResults.filter(r => r.success).length
      const failCount = notificationResults.filter(r => !r.success).length
      
      channelResults[channel] = {
        sent: successCount,
        failed: failCount,
        alreadyNotified: users.length - usersToNotify.length
      }
      
      totalNotificationsSent += successCount
      totalNotificationsFailed += failCount
    } else {
      channelResults[channel] = {
        sent: 0,
        failed: 0,
        alreadyNotified: users.length
      }
    }
  }
  
  return {
    totalFound: users.length,
    newNotifications: totalNotificationsSent,
    failedNotifications: totalNotificationsFailed,
    channelResults
  }
}

/**
 * Process job to check for paid users (runs every 10 minutes)
 * Implements idempotent notifications - only sends notification once per user per channel
 */
export const processPaidUserCheck = async (job: Job<PaidUserCheckJobData>): Promise<JobResult> => {
  try {
    console.log('💳 Processing paid user check job...')
    
    // Get users who upgraded to paid in the last 10 minutes
    const paidUsers = await UserMonitoringRepo.getPaidUsers(10)
    console.log(`📊 Found ${paidUsers.length} recently paid users`)
    
    // Use generic idempotent notification processing
    const results = await processNotificationsWithIdempotency(
      paidUsers,
      'paid_user',
      (user) => `paid_license_${user.license_id}`,
      '📨'
    )
    
    console.log(`✅ Paid user check completed - ${results.newNotifications} notifications sent, ${results.failedNotifications} failed`)
    console.log(`📊 Channel breakdown:`, results.channelResults)
    
    const targetChannels = getNotificationEngine().getConfig().events.paid_user
    
    return {
      success: true,
      message: `Paid user check completed - sent ${results.newNotifications} notifications across ${targetChannels.length} channels`,
      data: results,
      processedAt: new Date()
    }
  } catch (error) {
    console.error('❌ Error processing paid user check:', error)
    return {
      success: false,
      message: `Failed to check paid users: ${error}`,
      processedAt: new Date()
    }
  }
}

/**
 * Process job to check for inactive users (runs daily)
 * Implements idempotent notifications - only sends notification once per user per channel
 */
export const processInactiveUserCheck = async (job: Job<InactiveUserCheckJobData>): Promise<JobResult> => {
  try {
    console.log('😴 Processing inactive user check job...')
    
    // Get users who have been inactive for 5+ days
    const inactiveUsers = await UserMonitoringRepo.getInactiveUsers(5)
    console.log(`📊 Found ${inactiveUsers.length} inactive users`)
    
    // Use generic idempotent notification processing
    const results = await processNotificationsWithIdempotency(
      inactiveUsers,
      'inactive_user',
      (user) => `inactive_${user.id}`,
      '😴'
    )
    
    console.log(`✅ Inactive user check completed - ${results.newNotifications} notifications sent, ${results.failedNotifications} failed`)
    console.log(`📊 Channel breakdown:`, results.channelResults)
    
    const targetChannels = getNotificationEngine().getConfig().events.inactive_user
    
    // Get additional metrics for context
    const totalUsers = await UserMonitoringRepo.getTotalUserCount()
    const activitySummary = await UserMonitoringRepo.getUserActivitySummary(7)
    
    return {
      success: true,
      message: `Inactive user check completed - sent ${results.newNotifications} notifications across ${targetChannels.length} channels`,
      data: { 
        ...results,
        totalUsers,
        activitySummary
      },
      processedAt: new Date()
    }
  } catch (error) {
    console.error('❌ Error processing inactive user check:', error)
    return {
      success: false,
      message: `Failed to check inactive users: ${error}`,
      processedAt: new Date()
    }
  }
}

/**
 * Process test job (runs every minute)
 */
export const processTestJob = async (job: Job<TestJobData>): Promise<JobResult> => {
  try {
    console.log('🧪 Processing test job...')
    console.log('✅ Job queue is running! Test job completed successfully')
    
    return {
      success: true,
      message: 'Test job completed - job queue is working',
      data: { timestamp: new Date().toISOString() },
      processedAt: new Date()
    }
  } catch (error) {
    console.error('❌ Error processing test job:', error)
    return {
      success: false,
      message: `Failed to process test job: ${error}`,
      processedAt: new Date()
    }
  }
}

/**
 * Job processor registry
 */
export const jobProcessors = {
  'check-new-users': processNewUserCheck,
  'check-paid-users': processPaidUserCheck,
  'check-inactive-users': processInactiveUserCheck,
  'test-job': processTestJob,
} 
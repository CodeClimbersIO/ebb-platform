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
  JobResult 
} from '../types/jobs'

/**
 * Process job to check for new users (runs every 10 minutes)
 */
export const processNewUserCheck = async (job: Job<NewUserCheckJobData>): Promise<JobResult> => {
  try {
    console.log('🔍 Processing new user check job...')
    
    const newUsers = await UserMonitoringRepo.getNewUsers(10) // Last 10 minutes
    console.log('✅ New user check completed (stub implementation)')
    
    return {
      success: true,
      message: `New user check completed - found ${newUsers.length} users`,
      data: { count: newUsers.length },
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
 * Process job to check for paid users (runs every 10 minutes)
 * Implements idempotent notifications - only sends notification once per user per channel
 */
export const processPaidUserCheck = async (job: Job<PaidUserCheckJobData>): Promise<JobResult> => {
  try {
    console.log('💳 Processing paid user check job...')
    
    // Get users who upgraded to paid in the last 10 minutes
    const paidUsers = await UserMonitoringRepo.getPaidUsers(10)
    console.log(`📊 Found ${paidUsers.length} recently paid users`)
    
    if (paidUsers.length === 0) {
      console.log('✅ No new paid users to notify')
      return {
        success: true,
        message: 'No new paid users found',
        data: { 
          totalFound: 0,
          newNotifications: 0,
          alreadyNotified: 0
        },
        processedAt: new Date()
      }
    }
    
    // Initialize notification engine
    const notificationEngine = getNotificationEngine()
    const targetChannels = notificationEngine.getConfig().events.paid_user
    
    // Create a map of user ID to reference ID for idempotency checking
    const userNotificationMap: { [userId: string]: string } = {}
    paidUsers.forEach(user => {
      // Generate reference ID based on license ID if available, otherwise use timestamp
      const referenceId = user.license_id 
        ? `paid_license_${user.license_id}` 
        : `paid_${user.id}_${user.paid_at.getTime()}`
      userNotificationMap[user.id] = referenceId
    })
    
    // For each channel, filter out users we've already notified (per-channel idempotency)
    const channelResults: { [channel: string]: any } = {}
    let totalNotificationsSent = 0
    let totalNotificationsFailed = 0
    
    for (const channel of targetChannels) {
      console.log(`📨 Processing ${channel} notifications...`)
      
      // Filter out users already notified via this specific channel
      const unnotifiedUserIds = await UserNotificationsRepo.filterUnnotifiedUsersByChannelReference(
        userNotificationMap, 
        'paid_user',
        channel as any
      )
      
      // Get the user objects for unnotified users
      const usersToNotify = paidUsers.filter(user => unnotifiedUserIds.includes(user.id))
      
      console.log(`📨 Sending ${channel} notifications to ${usersToNotify.length} users (${paidUsers.length - usersToNotify.length} already notified via ${channel})`)
      
      if (usersToNotify.length > 0) {
        // Send notifications for new paid users via this channel
        const notificationResults = await notificationEngine.sendBatchNotifications(
          usersToNotify, 
          'paid_user',
          [channel as any]
        )
        
        // Record notifications in database to ensure per-channel idempotency
        const recordingPromises = notificationResults
          .filter(result => result.success)
          .map(result => 
            UserNotificationsRepo.recordChannelNotification(
              result.userId, 
              'paid_user',
              result.referenceId,
              result.channel as any,
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
          alreadyNotified: paidUsers.length - usersToNotify.length
        }
        
        totalNotificationsSent += successCount
        totalNotificationsFailed += failCount
      } else {
        channelResults[channel] = {
          sent: 0,
          failed: 0,
          alreadyNotified: paidUsers.length
        }
      }
    }
    
    console.log(`✅ Paid user check completed - ${totalNotificationsSent} notifications sent, ${totalNotificationsFailed} failed`)
    console.log(`📊 Channel breakdown:`, channelResults)
    
    return {
      success: true,
      message: `Paid user check completed - sent ${totalNotificationsSent} notifications across ${targetChannels.length} channels`,
      data: { 
        totalFound: paidUsers.length,
        newNotifications: totalNotificationsSent,
        failedNotifications: totalNotificationsFailed,
        channelResults
      },
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
 */
export const processInactiveUserCheck = async (job: Job<InactiveUserCheckJobData>): Promise<JobResult> => {
  try {
    console.log('😴 Processing inactive user check job...')
    
    const inactiveUsers = await UserMonitoringRepo.getInactiveUsers(7) // 7+ days inactive
    const totalUsers = await UserMonitoringRepo.getTotalUserCount()
    const activitySummary = await UserMonitoringRepo.getUserActivitySummary(7)
    
    console.log('✅ Inactive user check completed (stub implementation)')
    
    return {
      success: true,
      message: `Inactive user check completed - found ${inactiveUsers.length} users`,
      data: { 
        count: inactiveUsers.length,
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
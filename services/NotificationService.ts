import type { PaidUserRecord } from '../types/jobs'

/**
 * Generate a reference ID for a notification instance
 * This ensures each notification event has a unique identifier
 */
const generateReferenceId = (
  notificationType: string,
  userId: string,
  eventData?: any
): string => {
  switch (notificationType) {
    case 'paid_user':
      // For paid users, prefer license ID if available, otherwise use timestamp
      if (eventData?.license_id) {
        return `paid_license_${eventData.license_id}`
      }
      const paidAt = eventData?.paid_at || new Date()
      return `paid_${userId}_${paidAt.getTime()}`
    
    case 'weekly_report':
      // For weekly reports, use the week number and year
      const now = new Date()
      const year = now.getFullYear()
      const week = Math.ceil((now.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
      return `weekly_${year}_W${week.toString().padStart(2, '0')}`

    case 'inactive_user':
      // For inactive users, use their user id
      return `inactive_${userId}`
    
    case 'new_user':
      // For new users, use their signup timestamp
      const signupAt = eventData?.created_at || new Date()
      return `new_${userId}_${signupAt.getTime()}`
    
    default:
      // Generic fallback
      return `${notificationType}_${userId}_${Date.now()}`
  }
}

export interface NotificationResult {
  success: boolean
  message: string
  userId: string
  referenceId: string
  notificationId?: string
  error?: string
}

/**
 * Send notification for a new paid user
 * Currently logs to console, but can be easily replaced with:
 * - Email notifications
 * - Slack/Discord webhooks
 * - Push notifications
 * - SMS
 * - Third-party services like SendGrid, Twilio, etc.
 */
const sendPaidUserNotification = async (user: PaidUserRecord): Promise<NotificationResult> => {
  const referenceId = generateReferenceId('paid_user', user.id, { 
    paid_at: user.paid_at, 
    license_id: user.license_id 
  })
  
  try {
    console.log('🔔 NOTIFICATION: New Paid User!')
    console.log(`   👤 User: ${user.email}`)
    console.log(`   💰 License: ${user.subscription_status}`)
    console.log(`   📅 Paid At: ${user.paid_at.toISOString()}`)
    console.log(`   🆔 Reference: ${referenceId}`)
    if (user.license_id) {
      console.log(`   🎫 License ID: ${user.license_id}`)
    }
    if (user.stripe_payment_id) {
      console.log(`   💳 Stripe Payment: ${user.stripe_payment_id}`)
    }
    console.log(`   🎉 Welcome to the paid tier!`)
    
    // TODO: Replace with actual notification implementation
    // Examples:
    // - await sendEmail(user.email, 'Welcome to Premium!', template)
    // - await sendSlackNotification(`New paid user: ${user.email}`)
    // - await sendDiscordWebhook(`🎉 ${user.email} upgraded to premium!`)
    
    return {
      success: true,
      message: `Notification sent successfully to ${user.email}`,
      userId: user.id,
      referenceId,
      notificationId: `console_${Date.now()}_${user.id}`
    }
  } catch (error) {
    console.error('❌ Failed to send paid user notification:', error)
    return {
      success: false,
      message: `Failed to send notification to ${user.email}`,
      userId: user.id,
      referenceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send notification for a new user (can be used for other notification types)
 */
const sendNewUserNotification = async (user: { id: string; email: string; created_at?: Date }): Promise<NotificationResult> => {
  const referenceId = generateReferenceId('new_user', user.id, { created_at: user.created_at })
  
  try {
    console.log('🔔 NOTIFICATION: New User!')
    console.log(`   👤 User: ${user.email}`)
    console.log(`   📅 Joined: ${new Date().toISOString()}`)
    console.log(`   🆔 Reference: ${referenceId}`)
    
    return {
      success: true,
      message: `New user notification sent to ${user.email}`,
      userId: user.id,
      referenceId,
      notificationId: `console_${Date.now()}_${user.id}`
    }
  } catch (error) {
    console.error('❌ Failed to send new user notification:', error)
    return {
      success: false,
      message: `Failed to send notification to ${user.email}`,
      userId: user.id,
      referenceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send batch notifications for multiple users
 */
const sendBatchNotifications = async (
  users: PaidUserRecord[], 
  notificationType: 'paid' | 'new' = 'paid'
): Promise<NotificationResult[]> => {
  console.log(`📨 Sending ${notificationType} notifications to ${users.length} users...`)
  
  const results: NotificationResult[] = []
  
  for (const user of users) {
    const result = notificationType === 'paid' 
      ? await sendPaidUserNotification(user)
      : await sendNewUserNotification(user)
    
    results.push(result)
    
    // Add small delay to avoid overwhelming notification services
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length
  
  console.log(`📊 Batch notification results: ${successCount} sent, ${failCount} failed`)
  
  return results
}


export const NotificationService = {
  sendPaidUserNotification,
  sendNewUserNotification,
  sendBatchNotifications,
  generateReferenceId
} 
import { Job } from 'bullmq'
import { UserMonitoringRepo } from '../repos/UserMonitoring'
import { SlackService } from './SlackService.js'
import type { 
  NewUserCheckJobData, 
  PaidUserCheckJobData, 
  InactiveUserCheckJobData,
  TestJobData,
  SlackCleanupJobData,
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

/**
 * Process job to check for paid users (runs every 10 minutes)
 */
export const processPaidUserCheck = async (job: Job<PaidUserCheckJobData>): Promise<JobResult> => {
  try {
    console.log('💳 Processing paid user check job...')
    
    const paidUsers = await UserMonitoringRepo.getPaidUsers(10) // Last 10 minutes
    console.log('✅ Paid user check completed (stub implementation)')
    
    return {
      success: true,
      message: `Paid user check completed - found ${paidUsers.length} users`,
      data: { count: paidUsers.length },
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
 * Process Slack cleanup job for expired focus sessions
 */
export const processSlackCleanup = async (job: Job<SlackCleanupJobData>): Promise<JobResult> => {
  try {
    const { sessionId, userId } = job.data
    console.log(`🧹 Processing Slack cleanup job for session ${sessionId}...`)
    
    await SlackService.cleanupExpiredFocusSession(sessionId, userId)
    
    return {
      success: true,
      message: `Slack cleanup completed for session ${sessionId}`,
      data: { sessionId, userId },
      processedAt: new Date()
    }
  } catch (error) {
    console.error('❌ Error processing Slack cleanup job:', error)
    return {
      success: false,
      message: `Failed to cleanup Slack session: ${error}`,
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
  'slack-cleanup-dnd': processSlackCleanup,
  'slack-cleanup-status': processSlackCleanup,
} 
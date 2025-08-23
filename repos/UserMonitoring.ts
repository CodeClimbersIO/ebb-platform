import { db } from '../config/database'
import type { NewUserRecord, PaidUserRecord, InactiveUserRecord } from '../types/jobs'

const authUsersTable = 'auth.users'

/**
 * Get users created within the last specified minutes
 */
const getNewUsers = async (withinMinutes: number = 10): Promise<NewUserRecord[]> => {
  try {
    console.log(`🔍 Checking for new users in last ${withinMinutes} minutes`)
    
    const cutoffTime = new Date()
    cutoffTime.setMinutes(cutoffTime.getMinutes() - withinMinutes)

    const query = `
      SELECT 
        id,
        email,
        created_at
      FROM auth.users
      WHERE created_at >= ?
      ORDER BY created_at DESC
    `
    
    const result = await db.raw(query, [cutoffTime.toISOString()])
    
    console.log(`📊 Found ${result.rows.length} new users`)
    
    return result.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      created_at: new Date(row.created_at)
    }))
  } catch (error) {
    console.error('Error fetching new users:', error)
    return []
  }
}

/**
 * Get paid users - Users who purchased a license in the last specified minutes
 * This looks for licenses with purchase_date within the timeframe and a valid stripe_payment_id
 */
const getPaidUsers = async (withinMinutes: number = 10): Promise<PaidUserRecord[]> => {
  try {
    console.log(`💳 Checking for paid users in last ${withinMinutes} minutes`)
    
    const cutoffTime = new Date()
    cutoffTime.setMinutes(cutoffTime.getMinutes() - withinMinutes)

    // Query for users who recently purchased licenses with stripe payment
    const query = `
      SELECT 
        l.id as license_id,
        l.user_id,
        l.purchase_date,
        l.license_type,
        l.stripe_payment_id,
        l.stripe_customer_id,
        u.email
      FROM license l
      JOIN auth.users u ON u.id = l.user_id
      WHERE l.purchase_date >= ?
        AND l.stripe_payment_id IS NOT NULL
        AND l.stripe_payment_id != ''
        AND l.status = 'active'
      ORDER BY l.purchase_date DESC
    `
    
    const result = await db.raw(query, [cutoffTime.toISOString()])
    
    console.log(`📊 Found ${result.rows.length} recently purchased licenses with Stripe payments`)
    
    return result.rows.map((row: any) => {
      return {
        id: row.user_id,
        email: row.email,
        subscription_status: row.license_type || 'paid',
        paid_at: new Date(row.purchase_date),
        license_id: row.license_id,
        stripe_payment_id: row.stripe_payment_id,
        stripe_customer_id: row.stripe_customer_id
      }
    })
  } catch (error) {
    console.error('Error fetching paid users from license table:', error)
    // Return empty array on error to avoid breaking the job
    return []
  }
}

/**
 * Get users who have been inactive for more than the specified days
 */
const getInactiveUsers = async (inactiveDays: number = 5): Promise<InactiveUserRecord[]> => {
  try {
    console.log(`😴 Checking for users inactive for ${inactiveDays}+ days`)
    
    const cutoffTime = new Date()
    cutoffTime.setDate(cutoffTime.getDate() - inactiveDays)

    const query = `
      SELECT 
        up.id,
        u.email,
        up.last_check_in,
        EXTRACT(DAY FROM NOW() - up.last_check_in) as days_inactive
      FROM user_profile up
      JOIN auth.users u ON u.id = up.id
      WHERE up.last_check_in <= ?
        AND up.last_check_in IS NOT NULL
      ORDER BY up.last_check_in ASC
    `
    
    const result = await db.raw(query, [cutoffTime.toISOString()])
    
    console.log(`📊 Found ${result.rows.length} inactive users`)
    
    return result.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      last_activity: new Date(row.last_check_in),
      days_inactive: parseInt(row.days_inactive) || 0
    }))
  } catch (error) {
    console.error('Error fetching inactive users:', error)
    return []
  }
}

/**
 * Get total user count
 */
const getTotalUserCount = async (): Promise<number> => {
  console.log('📊 [STUB] Getting total user count')
  // TODO: Implement actual user count query
  return 0
}

/**
 * Get user activity summary for monitoring
 */
const getUserActivitySummary = async (days: number = 7) => {
  console.log(`📈 [STUB] Getting user activity summary for last ${days} days`)
  // TODO: Implement actual activity summary query
  return {
    active_users: 0,
    total_minutes: 0,
    avg_minutes_per_user: 0
  }
}

/**
 * Update users to offline status if they haven't checked in for 5+ minutes
 */
const updateOfflineUsers = async (): Promise<{ affectedRows: number }> => {
  try {
    console.log('🔄 Updating users to offline status...')
    
    const cutoffTime = new Date()
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 5) // 5 minutes ago

    const query = `
      UPDATE user_profile 
      SET 
        online_status = 'offline',
        updated_at = NOW()
      WHERE 
        last_check_in < ? 
        AND online_status != 'offline'
    `
    
    const result = await db.raw(query, [cutoffTime.toISOString()])
    const affectedRows = result.rowCount || 0
    
    console.log(`📊 Updated ${affectedRows} users to offline status`)
    
    return { affectedRows }
  } catch (error) {
    console.error('Error updating offline users:', error)
    return { affectedRows: 0 }
  }
}

export const UserMonitoringRepo = {
  getNewUsers,
  getPaidUsers,
  getInactiveUsers,
  getTotalUserCount,
  getUserActivitySummary,
  updateOfflineUsers
} 
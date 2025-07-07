import { db } from '../config/database'

export interface ActivityDayRollup {
  id: string
  user_id: string
  date: string
  tag_name: string
  total_duration_minutes: number
  created_at: string
  updated_at: string
}

export interface ActivityUpdate {
  user_id: string
  date: string
  tag_name: string
  duration_minutes: number
}

const tableName = 'activity_day_rollup'

export const ActivityDayRollupRepo = {
  async upsertActivity(update: ActivityUpdate): Promise<ActivityDayRollup> {
    const [activity] = await db(tableName)
      .insert({
        user_id: update.user_id,
        date: update.date,
        tag_name: update.tag_name,
        total_duration_minutes: update.duration_minutes
      })
      .onConflict(['user_id', 'date', 'tag_name'])
      .merge()
      .returning('*')

    return activity
  },

  async getUserActivityByDate(userId: string, date: string): Promise<number> {
    const result = await db(tableName)
      .where({ user_id: userId, date })
      .sum('total_duration_minutes as total')
      .first()

    return parseInt(result?.total as string) || 0
  },

  async getCommunityActivityByDate(date: string): Promise<{ totalMinutes: number; userCount: number; averageMinutes: number }> {
    const result = await db(tableName)
      .where({ date })
      .select(
        db.raw('SUM(total_duration_minutes) as total_minutes'),
        db.raw('COUNT(DISTINCT user_id) as user_count')
      )
      .first()

    const totalMinutes = parseInt(result?.total_minutes as string) || 0
    const userCount = parseInt(result?.user_count as string) || 0
    const averageMinutes = userCount > 0 ? Math.round(totalMinutes / userCount) : 0

    return {
      totalMinutes,
      userCount,
      averageMinutes
    }
  },

  async getUserPercentile(userId: string, date: string): Promise<number> {
    const userTotal = await this.getUserActivityByDate(userId, date)
    
    const result = await db(tableName)
      .where({ date })
      .select(db.raw('COUNT(DISTINCT user_id) as user_count'))
      .andWhere(
        db.raw('(SELECT SUM(total_duration_minutes) FROM activity_day_rollup WHERE user_id = ? AND date = ?)', [userId, date]),
        '>=',
        db.raw('(SELECT SUM(total_duration_minutes) FROM activity_day_rollup as inner_rollup WHERE inner_rollup.user_id = activity_day_rollup.user_id AND inner_rollup.date = ?)', [date])
      )
      .first()

    const usersWithLessActivity = parseInt(result?.user_count as string) || 0
    
    // Get total number of users for this date
    const totalUsersResult = await db(tableName)
      .where({ date })
      .countDistinct('user_id as count')
      .first()

    const totalUsers = parseInt(totalUsersResult?.count as string) || 1
    
    return totalUsers > 0 ? Math.round((usersWithLessActivity / totalUsers) * 100) : 0
  },

  async getFriendsActivityByDate(friendIds: string[], date: string): Promise<Array<{ userId: string; totalMinutes: number }>> {
    if (friendIds.length === 0) return []

    const result = await db(tableName)
      .whereIn('user_id', friendIds)
      .where({ date })
      .select('user_id', db.raw('SUM(total_duration_minutes) as total_minutes'))
      .groupBy('user_id')

    return result.map(row => ({
      userId: row.user_id,
      totalMinutes: parseInt(row.total_minutes as string) || 0
    }))
  },

  async getWeeklyActivityAggregation(): Promise<Array<{ week_start: string; total_hours: number }>> {
    const result = await db(tableName)
      .select(
        db.raw('DATE_TRUNC(\'week\', date) as week_start'),
        db.raw('SUM(total_duration_minutes) / 60 as total_hours'),
        db.raw('COUNT(DISTINCT date) as days_count')
      )
      .groupBy(db.raw('DATE_TRUNC(\'week\', date)'))
      .orderByRaw('DATE_TRUNC(\'week\', date) ASC')

    // Filter out the current week if it has less than 5 days
    const now = new Date()
    const currentWeekStart = new Date(now)
    currentWeekStart.setDate(now.getDate() - now.getDay()) // Start of current week (Sunday)
    currentWeekStart.setHours(0, 0, 0, 0)
    
    const filteredResult = result.filter((row: any) => {
      const weekStart = new Date(row.week_start)
      const daysCount = parseInt(row.days_count as string) || 0
        return daysCount >= 5
    })

    return filteredResult.map((row: any) => ({
      week_start: row.week_start,
      total_hours: parseFloat(row.total_hours as string) || 0
    }))
  },

  async getTotalHoursCreating(): Promise<number> {
    const result = await db(tableName)
      .sum('total_duration_minutes as total')
      .first()

    const totalMinutes = parseInt(result?.total as string) || 0
    return totalMinutes / 60 // Convert to hours
  },

  async getAverageWeeklyHoursForActiveUsers(): Promise<number> {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoTimestamp = sevenDaysAgo.toISOString()
    const sevenDaysAgoDateStr = sevenDaysAgo.toISOString().split('T')[0]

    const query = db(tableName)
      .join('user_profile', `${tableName}.user_id`, 'user_profile.id')
      .select(
        db.raw('COUNT(DISTINCT activity_day_rollup.user_id) as active_users'),
        db.raw('SUM(total_duration_minutes) / 60 as total_hours')
      )
      .whereRaw('user_profile.last_check_in >= ?', [sevenDaysAgoTimestamp])
      .whereRaw('activity_day_rollup.date >= ?', [sevenDaysAgoDateStr])
      .first()

    const result = await query

    const activeUsers = parseInt(result?.active_users as string) || 0
    const totalHours = parseFloat(result?.total_hours as string) || 0

    return activeUsers > 0 ? totalHours / activeUsers : 0
  },

  async getDailyActivityForPeriod(days: number = 90): Promise<Array<{ date: string; total_minutes: number }>> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const result = await db(tableName)
      .select(
        'date',
        db.raw('SUM(total_duration_minutes) as total_minutes')
      )
      .whereRaw('date >= ?', [startDateStr])  
      .groupBy('date')
      .orderBy('date', 'desc')

    return result.map((row: any) => ({
      date: row.date,
      total_minutes: parseInt(row.total_minutes as string) || 0
    }))
  },

  async getTopCreatingDays(limit: number = 10): Promise<Array<{ date: string; total_hours: number }>> {
    const result = await db(tableName)
      .select(
        'date',
        db.raw('SUM(total_duration_minutes) / 60 as total_hours')
      )
      .groupBy('date')
      .orderByRaw('SUM(total_duration_minutes) DESC')
      .limit(limit)

    return result.map((row: any) => ({
      date: row.date,
      total_hours: parseFloat(row.total_hours as string) || 0
    }))
  }
} 
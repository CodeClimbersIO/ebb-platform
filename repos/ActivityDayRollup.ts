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
  }
} 
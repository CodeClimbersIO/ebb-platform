import { ActivityDayRollupRepo } from '../repos/ActivityDayRollup'
import { ApiError } from '../middleware/errorHandler'
import { getCachedOrFetch, getCacheKey, MARKETING_CACHE_KEYS } from '../utils/cache'

export interface WeeklyActivity {
  week_start: string
  total_hours: number
}

export interface DailyActivity {
  date: string
  total_minutes: number
}

export interface TopCreatingDay {
  date: string
  total_hours: number
}

export interface CumulativeWeeklyHours {
  week_start: string
  cumulative_hours: number
}

const getWeeklyActivityData = async (): Promise<WeeklyActivity[]> => {
  try {
    const weeklyData = await getCachedOrFetch(
      MARKETING_CACHE_KEYS.WEEKLY_ACTIVITY,
      () => ActivityDayRollupRepo.getWeeklyActivityAggregation()
    )
    return weeklyData
  } catch (error) {
    console.error('Service error fetching weekly activity data:', error)
    throw new ApiError('Failed to fetch weekly activity data', 500)
  }
}

const getTotalHoursCreating = async (): Promise<number> => {
  try {
    const totalHours = await getCachedOrFetch(
      MARKETING_CACHE_KEYS.TOTAL_HOURS,
      () => ActivityDayRollupRepo.getTotalHoursCreating()
    )
    return totalHours
  } catch (error) {
    console.error('Service error fetching total hours creating:', error)
    throw new ApiError('Failed to fetch total hours creating', 500)
  }
}

const getAverageWeeklyHours = async (): Promise<number> => {
  try {
    const averageHours = await getCachedOrFetch(
      MARKETING_CACHE_KEYS.AVERAGE_WEEKLY_HOURS,
      () => ActivityDayRollupRepo.getAverageWeeklyHoursForActiveUsers()
    )
    return averageHours
  } catch (error) {
    console.error('Service error fetching average weekly hours:', error)
    throw new ApiError('Failed to fetch average weekly hours', 500)
  }
}

const getDailyActivityData = async (days: number = 90): Promise<DailyActivity[]> => {
  try {
    const cacheKey = getCacheKey(MARKETING_CACHE_KEYS.DAILY_ACTIVITY, { days })
    const dailyData = await getCachedOrFetch(
      cacheKey,
      () => ActivityDayRollupRepo.getDailyActivityForPeriod(days)
    )
    return dailyData
  } catch (error) {
    console.error('Service error fetching daily activity data:', error)
    throw new ApiError('Failed to fetch daily activity data', 500)
  }
}

const getTopCreatingDays = async (limit: number = 10): Promise<TopCreatingDay[]> => {
  try {
    const cacheKey = getCacheKey(MARKETING_CACHE_KEYS.TOP_CREATING_DAYS, { limit })
    const topDays = await getCachedOrFetch(
      cacheKey,
      () => ActivityDayRollupRepo.getTopCreatingDays(limit)
    )
    return topDays
  } catch (error) {
    console.error('Service error fetching top creating days:', error)
    throw new ApiError('Failed to fetch top creating days', 500)
  }
}

const getCumulativeWeeklyHours = async (): Promise<CumulativeWeeklyHours[]> => {
  try {
    const cumulativeData = await getCachedOrFetch(
      MARKETING_CACHE_KEYS.CUMULATIVE_WEEKLY_HOURS,
      () => ActivityDayRollupRepo.getCumulativeWeeklyHours()
    )
    return cumulativeData
  } catch (error) {
    console.error('Service error fetching cumulative weekly hours:', error)
    throw new ApiError('Failed to fetch cumulative weekly hours', 500)
  }
}

export const MarketingService = {
  getWeeklyActivityData,
  getTotalHoursCreating,
  getAverageWeeklyHours,
  getDailyActivityData,
  getTopCreatingDays,
  getCumulativeWeeklyHours
} 
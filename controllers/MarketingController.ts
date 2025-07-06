import { Router } from 'express'
import type { Request, Response } from 'express'
import { MarketingService } from '../services/MarketingService'
import { asyncHandler } from '../middleware/errorHandler'
import { cache } from '../utils/cache'

const router = Router()

const getWeeklyActivityData = async (req: Request, res: Response): Promise<void> => {
  const weeklyData = await MarketingService.getWeeklyActivityData()
  res.json({
    success: true,
    data: weeklyData
  })
}

const getTotalHoursCreating = async (req: Request, res: Response): Promise<void> => {
  const totalHours = await MarketingService.getTotalHoursCreating()
  res.json({
    success: true,
    data: {
      total_hours: totalHours
    }
  })
}

const getAverageWeeklyHours = async (req: Request, res: Response): Promise<void> => {
  const averageHours = await MarketingService.getAverageWeeklyHours()
  res.json({
    success: true,
    data: {
      average_weekly_hours: averageHours
    }
  })
}

const getDailyActivityData = async (req: Request, res: Response): Promise<void> => {
  const days = req.query.days ? parseInt(req.query.days as string) : 90
  const dailyData = await MarketingService.getDailyActivityData(days)
  res.json({
    success: true,
    data: dailyData
  })
}

const getTopCreatingDays = async (req: Request, res: Response): Promise<void> => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
  const topDays = await MarketingService.getTopCreatingDays(limit)
  res.json({
    success: true,
    data: topDays
  })
}

const getCacheStatus = async (req: Request, res: Response): Promise<void> => {
  const stats = cache.getStats()
  const cacheInfo = {
    ...stats,
    items: stats.items.map(item => ({
      ...item,
      ageMinutes: Math.round(item.age / (1000 * 60)),
      ttlMinutes: Math.round(item.ttl / (1000 * 60)),
      isExpiringSoon: item.age > (item.ttl * 0.8) // 80% of TTL
    }))
  }
  
  res.json({
    success: true,
    data: cacheInfo
  })
}

// Public routes - no authentication required for marketing data
router.get('/weekly-activity', asyncHandler(getWeeklyActivityData))
router.get('/total-hours', asyncHandler(getTotalHoursCreating))
router.get('/average-weekly-hours', asyncHandler(getAverageWeeklyHours))
router.get('/daily-activity', asyncHandler(getDailyActivityData))
router.get('/top-creating-days', asyncHandler(getTopCreatingDays))
router.get('/cache-status', asyncHandler(getCacheStatus))

export const MarketingController = {
  router,
  getWeeklyActivityData,
  getTotalHoursCreating,
  getAverageWeeklyHours,
  getDailyActivityData,
  getTopCreatingDays,
  getCacheStatus
} 
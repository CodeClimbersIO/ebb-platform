import { ActivityDayRollupRepo, type ActivityUpdate } from '../repos/ActivityDayRollup.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { Request } from 'express'

const updateActivity = async (req: Request): Promise<ActivityUpdate> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  
  const { tag_name, duration_minutes, date } = req.body
  console.log('tag_name', tag_name)
  console.log('duration_minutes', duration_minutes)
  console.log('date', date)
  const userId = req.user.id

  if (!tag_name || typeof tag_name !== 'string') {
    throw new ApiError('Valid tag name is required', 400)
  }

  if (!duration_minutes || typeof duration_minutes !== 'number' || duration_minutes <= 0) {
    throw new ApiError('Valid duration in minutes is required', 400)
  }

  if (!date || typeof date !== 'string') {
    throw new ApiError('Valid date is required', 400)
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) {
    throw new ApiError('Date must be in YYYY-MM-DD format', 400)
  }

  try {
    const update: ActivityUpdate = {
      user_id: userId,
      date,
      tag_name,
      duration_minutes
    }

    await ActivityDayRollupRepo.upsertActivity(update)
    return update
  } catch (error) {
    console.error('Service error updating activity:', error)
    throw new ApiError('Failed to update activity', 500)
  }
}

export const RollupService = {
  updateActivity
} 
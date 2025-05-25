import { UserProfileRepo } from '../repos/UserProfile'
import type { StatusCount } from '../repos/UserProfile'
import { ApiError } from '../middleware/errorHandler.js'

type StatusCountsObject = {
  [key: string]: number
}

const getUserStatusCounts = async (): Promise<StatusCountsObject> => {
  try {
    const statusCounts = await UserProfileRepo.getUserStatusCounts()
    
    const result: StatusCountsObject = {
      online: 0,
      offline: 0,
      active: 0,
      flowing: 0
    }

    statusCounts.forEach((statusCount: StatusCount) => {
      result[statusCount.online_status] = statusCount.count
    })
    
    return result
  } catch (error) {
    console.error('Service error fetching user status counts:', error)
    throw new ApiError('Failed to fetch user status counts', 500)
  }
}

export const UserProfileService = {
  getUserStatusCounts
} 

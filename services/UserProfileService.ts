import { UserProfileRepo } from '../repos/UserProfile'
import type { StatusCount } from '../repos/UserProfile'
import { ApiError } from '../middleware/errorHandler.js'

type StatusCountsObject = {
  [key: string]: number
}

const getUserStatusCounts = async (): Promise<StatusCountsObject> => {
  try {
    const statusCounts = await UserProfileRepo.getUserStatusCounts()
    
    const allStatuses = ['online', 'offline', 'active', 'flowing']
    const result: StatusCountsObject = {}
    
    for (const status of allStatuses) {
      const existing = statusCounts.find((sc: StatusCount) => sc.online_status === status)
      result[status] = existing ? existing.count : 0
    }
    
    return result
  } catch (error) {
    console.error('Service error fetching user status counts:', error)
    throw new ApiError('Failed to fetch user status counts', 500)
  }
}

export const UserProfileService = {
  getUserStatusCounts
} 

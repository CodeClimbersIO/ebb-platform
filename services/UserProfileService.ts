import { UserProfileRepo } from '../repos/UserProfile'
import type { Location, StatusCount, UserProfile } from '../repos/UserProfile'
import { ApiError } from '../middleware/errorHandler'
import { GeoLocationService } from './GeoLocationService'
import type { Request } from 'express'

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

const saveUserLocation = async (req: Request): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User ID is required', 400)
  }
  const userId = req.user.id
  const clientIP = GeoLocationService.getClientIP(req)
  const userLocation = await GeoLocationService.getLocationByIP(clientIP)
  await UserProfileRepo.saveUserLocation(userId, userLocation)
}

const getUserLocations = async (): Promise<Location[]> => {
  const userLocations = await UserProfileRepo.getUserLocations()
  return userLocations
}

const getUserProfile = async (userId: string): Promise<UserProfile | undefined> => {
  const userProfile = await UserProfileRepo.getUserProfile(userId)
  return userProfile
}

export const UserProfileService = {
  getUserStatusCounts,
  saveUserLocation,
  getUserLocations,
  getUserProfile
} 

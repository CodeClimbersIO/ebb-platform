import { ActivityDayRollupRepo } from '../repos/ActivityDayRollup.js'
import { FriendsRepo } from '../repos/Friends.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { Request } from 'express'

interface DashboardInsights {
  userActivity: {
    totalMinutes: number
    minutesFormatted: string
  }
  topFriend: {
    hasFriends: boolean
    topFriendEmail?: string
    topFriendMinutes?: number
    topFriendFormatted?: string
  }
  userPercentile: {
    percentile: number
    betterThanPercent: number
  }
  communityComparison: {
    userMinutes: number
    userFormatted: string
    communityAverage: number
    communityAverageFormatted: string
    differenceMinutes: number
    differenceFormatted: string
    isAboveAverage: boolean
  }
  communityStats: {
    totalCommunityMinutes: number
    totalCommunityFormatted: string
    activeUsers: number
  }
}

const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours === 0) {
    return `${mins}m`
  }
  
  return `${hours}h ${mins}m`
}

const getDashboardInsights = async (req: Request): Promise<DashboardInsights> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const { date } = req.query
  const userId = req.user.id
  const userEmail = req.user.email

  if (!date || typeof date !== 'string') {
    throw new ApiError('Date is required', 400)
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) {
    throw new ApiError('Date must be in YYYY-MM-DD format', 400)
  }

  try {
    const userMinutes = await ActivityDayRollupRepo.getUserActivityByDate(userId, date)
    
    const communityStats = await ActivityDayRollupRepo.getCommunityActivityByDate(date)
    
    const percentile = await ActivityDayRollupRepo.getUserPercentile(userId, date)
    
    const friends = await FriendsRepo.getFriendsWithDetails(userId)
    const friendIds = friends.map(friend => friend.friend_id)
    
    const friendsActivity = await ActivityDayRollupRepo.getFriendsActivityByDate(friendIds, date)
    
    let topFriend = {
      hasFriends: friends.length > 0,
      topFriendEmail: undefined as string | undefined,
      topFriendMinutes: undefined as number | undefined,
      topFriendFormatted: undefined as string | undefined
    }

    if (friends.length > 0) {
      // Find the friend with the most activity
      let topFriendActivity = null
      if (friendsActivity.length > 0) {
        topFriendActivity = friendsActivity.reduce((prev, current) => 
          current.totalMinutes > prev.totalMinutes ? current : prev
        )
      }

      // Compare user's activity with top friend's activity
      if (!topFriendActivity || userMinutes >= topFriendActivity.totalMinutes) {
        // User has the most activity (or tied for most)
        topFriend.topFriendEmail = userEmail
        topFriend.topFriendMinutes = userMinutes
        topFriend.topFriendFormatted = formatMinutes(userMinutes)
      } else {
        // A friend has more activity than the user
        const topFriendDetails = friends.find(f => f.friend_id === topFriendActivity.userId)
        if (topFriendDetails) {
          topFriend.topFriendEmail = topFriendDetails.friend_email
          topFriend.topFriendMinutes = topFriendActivity.totalMinutes
          topFriend.topFriendFormatted = formatMinutes(topFriendActivity.totalMinutes)
        }
      }
    }

    // Calculate differences
    const differenceMinutes = userMinutes - communityStats.averageMinutes
    const isAboveAverage = differenceMinutes > 0

    return {
      userActivity: {
        totalMinutes: userMinutes,
        minutesFormatted: formatMinutes(userMinutes)
      },
      topFriend,
      userPercentile: {
        percentile,
        betterThanPercent: percentile
      },
      communityComparison: {
        userMinutes,
        userFormatted: formatMinutes(userMinutes),
        communityAverage: communityStats.averageMinutes,
        communityAverageFormatted: formatMinutes(communityStats.averageMinutes),
        differenceMinutes: Math.abs(differenceMinutes),
        differenceFormatted: (isAboveAverage ? '+' : '-') + formatMinutes(Math.abs(differenceMinutes)),
        isAboveAverage
      },
      communityStats: {
        totalCommunityMinutes: communityStats.totalMinutes,
        totalCommunityFormatted: formatMinutes(communityStats.totalMinutes),
        activeUsers: communityStats.userCount
      }
    }
  } catch (error) {
    console.error('Service error getting dashboard insights:', error)
    throw new ApiError('Failed to get dashboard insights', 500)
  }
}

export const FriendDashboardService = {
  getDashboardInsights
} 
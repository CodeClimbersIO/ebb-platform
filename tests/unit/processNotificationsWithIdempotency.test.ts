import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test'
import { processNotificationsWithIdempotency } from '../../services/JobProcessors'
import type { NewUserRecord, InactiveUserRecord } from '../../types/notifications'

// Mock dependencies directly
const mockNotificationEngine = {
  getConfig: mock(() => ({
    events: {
      new_user: ['discord', 'email'],
      inactive_user: ['discord']
    }
  })),
  sendBatchNotifications: mock()
}

const mockUserNotificationsRepo = {
  filterUnnotifiedUsersByChannelReference: mock(),
  recordChannelNotification: mock()
}

// Mock modules
mock.module('../../services/NotificationEngine', () => ({
  NotificationEngine: mock(() => mockNotificationEngine)
}))

mock.module('../../repos/UserNotifications', () => ({
  UserNotificationsRepo: mockUserNotificationsRepo
}))

mock.module('../../config/notifications', () => ({
  getNotificationConfig: mock(() => ({
    events: {
      new_user: ['discord', 'email'],
      inactive_user: ['discord']
    }
  }))
}))

describe('processNotificationsWithIdempotency', () => {
  beforeEach(() => {
    // Clear all mocks
    mockNotificationEngine.getConfig.mockClear()
    mockNotificationEngine.sendBatchNotifications.mockClear()
    mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference.mockClear()
    mockUserNotificationsRepo.recordChannelNotification.mockClear()
  })

  describe('empty user list', () => {
    it('should return zero results when no users provided', async () => {
      const result = await processNotificationsWithIdempotency(
        [],
        'new_user',
        (user: any) => `test_${user.id}`,
        '🧪'
      )

      expect(result).toEqual({
        totalFound: 0,
        newNotifications: 0,
        failedNotifications: 0,
        channelResults: {}
      })

      expect(mockNotificationEngine.sendBatchNotifications).not.toHaveBeenCalled()
      expect(mockUserNotificationsRepo.recordChannelNotification).not.toHaveBeenCalled()
    })
  })

  describe('idempotency logic', () => {
    const mockUsers: NewUserRecord[] = [
      {
        id: 'user-1',
        email: 'user1@example.com',
        created_at: new Date('2024-01-15T10:00:00Z')
      },
      {
        id: 'user-2',
        email: 'user2@example.com',
        created_at: new Date('2024-01-15T10:05:00Z')
      }
    ]

    it('should process all users when none have been notified', async () => {
      // Mock that no users have been notified yet for any channel
      mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference
        .mockResolvedValueOnce(['user-1', 'user-2']) // Discord
        .mockResolvedValueOnce(['user-1', 'user-2']) // Email

      // Mock successful notifications
      const mockDiscordResults = [
        {
          success: true,
          userId: 'user-1',
          referenceId: 'new_user-1_1705312800000',
          channel: 'discord',
          notificationId: 'discord_123',
          timestamp: new Date(),
          message: 'Success'
        },
        {
          success: true,
          userId: 'user-2',
          referenceId: 'new_user-2_1705313100000',
          channel: 'discord',
          notificationId: 'discord_124',
          timestamp: new Date(),
          message: 'Success'
        }
      ]

      const mockEmailResults = mockDiscordResults.map(r => ({ ...r, channel: 'email' }))

      mockNotificationEngine.sendBatchNotifications
        .mockResolvedValueOnce(mockDiscordResults)
        .mockResolvedValueOnce(mockEmailResults)

      mockUserNotificationsRepo.recordChannelNotification.mockResolvedValue({})

      const result = await processNotificationsWithIdempotency(
        mockUsers,
        'new_user',
        (user: NewUserRecord) => `new_${user.id}_${user.created_at.getTime()}`,
        '👋'
      )

      expect(result.totalFound).toBe(2)
      expect(result.newNotifications).toBe(4) // 2 users × 2 channels
      expect(result.failedNotifications).toBe(0)
      expect(result.channelResults).toEqual({
        discord: { sent: 2, failed: 0, alreadyNotified: 0 },
        email: { sent: 2, failed: 0, alreadyNotified: 0 }
      })

      // Verify correct calls were made
      expect(mockNotificationEngine.sendBatchNotifications).toHaveBeenCalledTimes(2)
      expect(mockUserNotificationsRepo.recordChannelNotification).toHaveBeenCalledTimes(4)
    })

    it('should skip already notified users per channel', async () => {
      // Mock that user-1 already notified via Discord, but not email
      mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference
        .mockResolvedValueOnce(['user-2']) // Only user-2 unnotified via Discord
        .mockResolvedValueOnce(['user-1', 'user-2']) // Both unnotified via email

      const mockDiscordResults = [{
        success: true,
        userId: 'user-2',
        referenceId: 'new_user-2_1705313100000',
        channel: 'discord',
        notificationId: 'discord_124',
        timestamp: new Date(),
        message: 'Success'
      }]

      const mockEmailResults = [
        {
          success: true,
          userId: 'user-1',
          referenceId: 'new_user-1_1705312800000',
          channel: 'email',
          notificationId: 'email_123',
          timestamp: new Date(),
          message: 'Success'
        },
        {
          success: true,
          userId: 'user-2',
          referenceId: 'new_user-2_1705313100000',
          channel: 'email',
          notificationId: 'email_124',
          timestamp: new Date(),
          message: 'Success'
        }
      ]

      mockNotificationEngine.sendBatchNotifications
        .mockResolvedValueOnce(mockDiscordResults)
        .mockResolvedValueOnce(mockEmailResults)

      mockUserNotificationsRepo.recordChannelNotification.mockResolvedValue({})

      const result = await processNotificationsWithIdempotency(
        mockUsers,
        'new_user',
        (user: NewUserRecord) => `new_${user.id}_${user.created_at.getTime()}`,
        '👋'
      )

      expect(result.totalFound).toBe(2)
      expect(result.newNotifications).toBe(3) // 1 Discord + 2 Email
      expect(result.failedNotifications).toBe(0)
      expect(result.channelResults).toEqual({
        discord: { sent: 1, failed: 0, alreadyNotified: 1 },
        email: { sent: 2, failed: 0, alreadyNotified: 0 }
      })
    })

    it('should handle all users already notified', async () => {
      // Mock that all users already notified via all channels
      mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference
        .mockResolvedValueOnce([]) // No users unnotified via Discord
        .mockResolvedValueOnce([]) // No users unnotified via email

      const result = await processNotificationsWithIdempotency(
        mockUsers,
        'new_user',
        (user: NewUserRecord) => `new_${user.id}_${user.created_at.getTime()}`,
        '👋'
      )

      expect(result.totalFound).toBe(2)
      expect(result.newNotifications).toBe(0)
      expect(result.failedNotifications).toBe(0)
      expect(result.channelResults).toEqual({
        discord: { sent: 0, failed: 0, alreadyNotified: 2 },
        email: { sent: 0, failed: 0, alreadyNotified: 2 }
      })

      expect(mockNotificationEngine.sendBatchNotifications).not.toHaveBeenCalled()
      expect(mockUserNotificationsRepo.recordChannelNotification).not.toHaveBeenCalled()
    })
  })

  describe('notification failures', () => {
    const mockUsers: NewUserRecord[] = [{
      id: 'user-1',
      email: 'user1@example.com',
      created_at: new Date('2024-01-15T10:00:00Z')
    }]

    it('should handle partial notification failures', async () => {
      mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference
        .mockResolvedValueOnce(['user-1']) // Discord
        .mockResolvedValueOnce(['user-1']) // Email

      const mockResults = [
        {
          success: true,
          userId: 'user-1',
          referenceId: 'new_user-1_1705312800000',
          channel: 'discord',
          notificationId: 'discord_123',
          timestamp: new Date(),
          message: 'Success'
        },
        {
          success: false,
          userId: 'user-1',
          referenceId: 'new_user-1_1705312800000',
          channel: 'discord',
          error: 'Discord webhook failed',
          timestamp: new Date(),
          message: 'Failed'
        }
      ]

      mockNotificationEngine.sendBatchNotifications
        .mockResolvedValueOnce(mockResults) // Discord
        .mockResolvedValueOnce([]) // Email (no results)
      mockUserNotificationsRepo.recordChannelNotification.mockResolvedValue({})

      const result = await processNotificationsWithIdempotency(
        mockUsers,
        'new_user',
        (user: NewUserRecord) => `new_${user.id}_${user.created_at.getTime()}`,
        '👋'
      )

      expect(result.newNotifications).toBe(1)
      expect(result.failedNotifications).toBe(1)
      expect(result.channelResults.discord).toEqual({
        sent: 1,
        failed: 1,
        alreadyNotified: 0
      })

      // Only successful notification should be recorded
      expect(mockUserNotificationsRepo.recordChannelNotification).toHaveBeenCalledTimes(1)
    })

    it('should handle all notifications failing', async () => {
      mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference
        .mockResolvedValueOnce(['user-1']) // Discord
        .mockResolvedValueOnce(['user-1']) // Email

      const mockResults = [{
        success: false,
        userId: 'user-1',
        referenceId: 'new_user-1_1705312800000',
        channel: 'discord',
        error: 'Service unavailable',
        timestamp: new Date(),
        message: 'Failed'
      }]

      mockNotificationEngine.sendBatchNotifications
        .mockResolvedValueOnce(mockResults) // Discord
        .mockResolvedValueOnce([]) // Email (no results)
      mockUserNotificationsRepo.recordChannelNotification.mockResolvedValue({})

      const result = await processNotificationsWithIdempotency(
        mockUsers,
        'new_user',
        (user: NewUserRecord) => `new_${user.id}_${user.created_at.getTime()}`,
        '👋'
      )

      expect(result.newNotifications).toBe(0)
      expect(result.failedNotifications).toBe(1)
      expect(result.channelResults.discord).toEqual({
        sent: 0,
        failed: 1,
        alreadyNotified: 0
      })

      // No notifications should be recorded
      expect(mockUserNotificationsRepo.recordChannelNotification).not.toHaveBeenCalled()
    })
  })

  describe('reference ID generation', () => {
    it('should use custom reference ID generator correctly', async () => {
      const mockInactiveUsers: InactiveUserRecord[] = [{
        id: 'user-inactive-1',
        email: 'inactive@example.com',
        last_activity: new Date('2024-01-08T10:00:00Z'),
        days_inactive: 7
      }]

      mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference
        .mockResolvedValueOnce(['user-inactive-1'])

      mockNotificationEngine.sendBatchNotifications.mockResolvedValueOnce([{
        success: true,
        userId: 'user-inactive-1',
        referenceId: 'inactive_user-inactive-1_1704708000000_7d',
        channel: 'discord',
        notificationId: 'discord_125',
        timestamp: new Date(),
        message: 'Success'
      }])

      mockUserNotificationsRepo.recordChannelNotification.mockResolvedValue({})

      await processNotificationsWithIdempotency(
        mockInactiveUsers,
        'inactive_user',
        (user: InactiveUserRecord) => `inactive_${user.id}_${user.last_activity.getTime()}_${user.days_inactive}d`,
        '😴'
      )

      // Verify reference ID was generated correctly
      expect(mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference).toHaveBeenCalledWith(
        {
          'user-inactive-1': 'inactive_user-inactive-1_1704708000000_7d'
        },
        'inactive_user',
        'discord'
      )
    })
  })

  describe('error handling', () => {
    const mockUsers = [{ id: 'user-1', email: 'test@example.com', created_at: new Date() }]

    it('should propagate database errors', async () => {
      mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference
        .mockRejectedValueOnce(new Error('Database connection failed'))

      await expect(processNotificationsWithIdempotency(
        mockUsers,
        'new_user',
        (user: any) => `test_${user.id}`,
        '🧪'
      )).rejects.toThrow('Database connection failed')
    })

    it('should propagate notification engine errors', async () => {
      mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference
        .mockResolvedValueOnce(['user-1'])
      
      mockNotificationEngine.sendBatchNotifications
        .mockRejectedValueOnce(new Error('Notification service down'))

      await expect(processNotificationsWithIdempotency(
        mockUsers,
        'new_user',
        (user: any) => `test_${user.id}`,
        '🧪'
      )).rejects.toThrow('Notification service down')
    })

    it('should propagate recording errors', async () => {
      mockUserNotificationsRepo.filterUnnotifiedUsersByChannelReference
        .mockResolvedValueOnce(['user-1'])
      
      mockNotificationEngine.sendBatchNotifications.mockResolvedValueOnce([{
        success: true,
        userId: 'user-1',
        referenceId: 'test_user-1',
        channel: 'discord',
        notificationId: 'discord_123',
        timestamp: new Date(),
        message: 'Success'
      }])

      mockUserNotificationsRepo.recordChannelNotification
        .mockRejectedValueOnce(new Error('Failed to record notification'))

      await expect(processNotificationsWithIdempotency(
        mockUsers,
        'new_user',
        (user: any) => `test_${user.id}`,
        '🧪'
      )).rejects.toThrow('Failed to record notification')
    })
  })
})
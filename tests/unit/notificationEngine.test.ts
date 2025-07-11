import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test'
import { NotificationEngine } from '../../services/NotificationEngine'
import type { 
  NotificationConfig, 
  NotificationProvider, 
  NotificationPayload, 
  NotificationResult,
  PaidUserRecord,
  NewUserRecord,
  NotificationChannel 
} from '../../types/notifications'

// Create mock functions for the provider
const mockSend = mock(() => Promise.resolve({
  success: true,
  message: 'Discord notification sent',
  userId: 'test-user',
  referenceId: 'test-ref',
  channel: 'discord',
  timestamp: new Date()
} as NotificationResult))

// Mock the DiscordNotificationProvider
const mockDiscordProvider: NotificationProvider = {
  name: 'discord',
  send: mockSend
}

// Mock the NotificationService for reference ID generation
const mockGenerateReferenceId = mock(() => 'test-reference-id')
const mockNotificationService = {
  generateReferenceId: mockGenerateReferenceId
}

// Mock the import
mock.module('../../services/providers/DiscordNotificationProvider', () => ({
  DiscordNotificationProvider: mock().mockImplementation(() => mockDiscordProvider)
}))

mock.module('../../services/NotificationService', () => ({
  NotificationService: mockNotificationService
}))

describe('NotificationEngine', () => {
  let engine: NotificationEngine
  let testConfig: NotificationConfig

  beforeEach(() => {
    testConfig = {
      channels: {
        discord: {
          enabled: true,
          webhookUrl: 'https://discord.com/api/webhooks/test'
        },
        email: {
          enabled: false
        },
        slack: {
          enabled: false
        },
        sms: {
          enabled: false
        }
      },
      events: {
        paid_user: ['discord'],
        new_user: ['discord'],
        inactive_user: ['discord'],
        weekly_report: ['discord']
      }
    }

    // Clear all mocks
    mockSend.mockClear()
    mockGenerateReferenceId.mockClear()
    
    engine = new NotificationEngine(testConfig)
  })

  describe('constructor and initialization', () => {
    it('should initialize with enabled providers', () => {
      expect(engine.getAvailableChannels()).toContain('discord')
      expect(engine.isChannelEnabled('discord')).toBe(true)
      expect(engine.isChannelEnabled('email')).toBe(false)
    })

    it('should not initialize disabled providers', () => {
      const configWithDisabledDiscord: NotificationConfig = {
        ...testConfig,
        channels: {
          ...testConfig.channels,
          discord: { enabled: false }
        }
      }

      const engineWithDisabled = new NotificationEngine(configWithDisabledDiscord)
      expect(engineWithDisabled.isChannelEnabled('discord')).toBe(false)
      expect(engineWithDisabled.getAvailableChannels()).not.toContain('discord')
    })

    it('should not initialize Discord provider without webhook URL', () => {
      const configWithoutWebhook: NotificationConfig = {
        ...testConfig,
        channels: {
          ...testConfig.channels,
          discord: { enabled: true, webhookUrl: undefined }
        }
      }

      const engineWithoutWebhook = new NotificationEngine(configWithoutWebhook)
      expect(engineWithoutWebhook.isChannelEnabled('discord')).toBe(false)
    })
  })

  describe('sendNotification', () => {
    const testPayload: NotificationPayload = {
      type: 'paid_user',
      user: {
        id: 'user-123',
        email: 'test@example.com'
      } as PaidUserRecord,
      referenceId: 'test-ref-123',
      data: {}
    }

    it('should send notification to single channel successfully', async () => {
      const results = await engine.sendNotification(testPayload, ['discord'])

      expect(results).toHaveLength(1)
      expect(results[0]?.success).toBe(true)
      expect(results[0]?.channel).toBe('discord')
      expect(mockSend).toHaveBeenCalledWith(testPayload)
    })

    it('should handle provider not found error', async () => {
      const results = await engine.sendNotification(testPayload, ['email' as NotificationChannel])

      expect(results).toHaveLength(1)
      expect(results[0]?.success).toBe(false)
      expect(results[0]?.error).toBe('Provider not configured')
      expect(results[0]?.channel).toBe('email')
    })

    it('should handle provider throwing error', async () => {
      // Mock the provider to throw an error
      mockSend.mockImplementationOnce(() => {
        throw new Error('Provider error')
      })

      const results = await engine.sendNotification(testPayload, ['discord'])

      expect(results).toHaveLength(1)
      expect(results[0]?.success).toBe(false)
      expect(results[0]?.error).toBe('Provider error')
      expect(results[0]?.channel).toBe('discord')
    })

    it('should send to multiple channels', async () => {
      // Add another provider to the config
      const multiChannelConfig: NotificationConfig = {
        ...testConfig,
        channels: {
          ...testConfig.channels,
          email: { enabled: true }
        }
      }

      const multiEngine = new NotificationEngine(multiChannelConfig)
      
      const results = await multiEngine.sendNotification(testPayload, ['discord', 'email'])

      expect(results).toHaveLength(2)
      expect(results.find(r => r.channel === 'discord')?.success).toBe(true)
      // Email provider doesn't exist, so it should fail
      expect(results.find(r => r.channel === 'email')?.success).toBe(false)
    })
  })

  describe('sendPaidUserNotifications', () => {
    const paidUser: PaidUserRecord = {
      id: 'paid-user-123',
      email: 'paid@example.com',
      subscription_status: 'premium',
      paid_at: new Date(),
      license_id: 'license-456',
      stripe_payment_id: 'pi_test',
      stripe_customer_id: 'cus_test'
    }

    it('should send paid user notification with default channels', async () => {
      const results = await engine.sendPaidUserNotifications(paidUser)

      expect(results).toHaveLength(1)
      expect(results[0]?.success).toBe(true)
      expect(mockGenerateReferenceId).toHaveBeenCalledWith(
        'paid_user',
        'paid-user-123',
        expect.objectContaining({
          paid_at: paidUser.paid_at,
          license_id: 'license-456'
        })
      )
    })

    it('should send paid user notification with custom channels', async () => {
      const results = await engine.sendPaidUserNotifications(paidUser, ['discord'])

      expect(results).toHaveLength(1)
      expect(results[0]?.channel).toBe('discord')
    })

    it('should include all paid user data in payload', async () => {
      await engine.sendPaidUserNotifications(paidUser)

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'paid_user',
          user: paidUser,
          data: {
            license_id: 'license-456',
            stripe_payment_id: 'pi_test',
            stripe_customer_id: 'cus_test'
          }
        })
      )
    })
  })

  describe('sendNewUserNotifications', () => {
    const newUser: NewUserRecord = {
      id: 'new-user-456',
      email: 'new@example.com',
      created_at: new Date()
    }

    it('should send new user notification with default channels', async () => {
      const results = await engine.sendNewUserNotifications(newUser)

      expect(results).toHaveLength(1)
      expect(results[0]?.success).toBe(true)
      expect(mockGenerateReferenceId).toHaveBeenCalledWith(
        'new_user',
        'new-user-456',
        expect.objectContaining({
          created_at: newUser.created_at
        })
      )
    })

    it('should include new user data in payload', async () => {
      await engine.sendNewUserNotifications(newUser)

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'new_user',
          user: newUser,
          data: {
            created_at: newUser.created_at
          }
        })
      )
    })
  })

  describe('sendBatchNotifications', () => {
    const paidUsers: PaidUserRecord[] = [
      {
        id: 'batch-user-1',
        email: 'batch1@example.com',
        subscription_status: 'premium',
        paid_at: new Date(),
        license_id: 'license-1'
      },
      {
        id: 'batch-user-2',
        email: 'batch2@example.com',
        subscription_status: 'premium',
        paid_at: new Date(),
        license_id: 'license-2'
      }
    ]

    it('should send batch paid user notifications', async () => {
      const results = await engine.sendBatchNotifications(paidUsers, 'paid_user', ['discord'])

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should handle unknown notification type', async () => {
      const results = await engine.sendBatchNotifications(paidUsers, 'unknown_type' as any, ['discord'])

      expect(results).toHaveLength(0)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should add delay between notifications', async () => {
      const startTime = Date.now()
      await engine.sendBatchNotifications(paidUsers, 'paid_user', ['discord'])
      const endTime = Date.now()

      // Should take at least 100ms for 2 notifications (100ms delay between them)
      expect(endTime - startTime).toBeGreaterThan(100)
    })
  })

  describe('configuration management', () => {
    it('should return current configuration', () => {
      const config = engine.getConfig()
      expect(config).toEqual(testConfig)
      expect(config).not.toBe(testConfig) // Should be a copy
    })

    it('should update configuration', () => {
      const updates = {
        events: {
          ...testConfig.events,
          paid_user: ['discord', 'email'] as NotificationChannel[]
        }
      }

      engine.updateConfig(updates)
      const newConfig = engine.getConfig()
      
      expect(newConfig.events.paid_user).toEqual(['discord', 'email'])
    })
  })

  describe('provider error handling', () => {
    it('should continue with other channels if one fails', async () => {
      // Mock discord to return a failure result
      mockSend.mockImplementationOnce(() => Promise.resolve({
        success: false,
        message: 'Discord failed',
        userId: 'test-user',
        referenceId: 'test-ref',
        channel: 'discord',
        error: 'Webhook error',
        timestamp: new Date()
      }))

      const testPayload: NotificationPayload = {
        type: 'paid_user',
        user: { id: 'test-user', email: 'test@example.com' } as any,
        referenceId: 'test-ref',
        data: {}
      }

      const results = await engine.sendNotification(testPayload, ['discord'])

      expect(results).toHaveLength(1)
      expect(results[0]?.success).toBe(false)
      expect(results[0]?.error).toBe('Webhook error')
    })
  })
})
import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { DiscordNotificationProvider } from '../../services/providers/DiscordNotificationProvider'
import type { NotificationPayload, PaidUserRecord, NewUserRecord } from '../../types/notifications'

// Store original fetch
const originalFetch = global.fetch
// Create a mock that maintains both fetch interface and mock methods
const mockFetch = mock() as unknown as typeof fetch & {
  mockClear(): void
  mockResolvedValueOnce(value: any): void
  mockRejectedValueOnce(value: any): void
  mock: { calls: any[] }
}

describe('DiscordNotificationProvider', () => {
  const mockWebhookUrl = 'https://discord.com/api/webhooks/123/test-webhook-token'
  let provider: DiscordNotificationProvider

  beforeEach(() => {
    global.fetch = mockFetch
    provider = new DiscordNotificationProvider(mockWebhookUrl)
    mockFetch.mockClear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('constructor', () => {
    it('should throw error if webhook URL is not provided', () => {
      expect(() => new DiscordNotificationProvider('')).toThrow('Discord webhook URL is required')
      expect(() => new DiscordNotificationProvider(undefined as unknown as string)).toThrow('Discord webhook URL is required')
    })

    it('should create provider with valid webhook URL', () => {
      expect(provider.name).toBe('discord')
    })
  })

  describe('send - paid user notifications', () => {
    const paidUserPayload: NotificationPayload = {
      type: 'paid_user',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        subscription_status: 'premium',
        paid_at: new Date('2024-01-15T10:30:00Z'),
        license_id: 'license-456',
        stripe_payment_id: 'pi_test_123',
        stripe_customer_id: 'cus_test_123'
      } as PaidUserRecord,
      referenceId: 'paid_license_456',
      data: {
        license_id: 'license-456',
        stripe_payment_id: 'pi_test_123'
      }
    }

    it('should send paid user notification successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      const result = await provider.send(paidUserPayload)

      expect(result.success).toBe(true)
      expect(result.userId).toBe('user-123')
      expect(result.referenceId).toBe('paid_license_456')
      expect(result.channel).toBe('discord')
      expect(result.message).toContain('Discord notification sent successfully')
      expect(result.notificationId).toMatch(/discord_\d+_user-123/)
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('should format paid user embed correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      await provider.send(paidUserPayload)

      expect(mockFetch).toHaveBeenCalledWith(
        mockWebhookUrl,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"title":"🎉 New Paid User!"')
        })
      )

      const callArgs = mockFetch.mock.calls?.[0]
      expect(callArgs).toBeDefined()
      const body = JSON.parse(callArgs![1].body)
      
      expect(body.embeds).toHaveLength(1)
      expect(body.embeds[0].title).toBe('🎉 New Paid User!')
      expect(body.embeds[0].color).toBe(0x00FF00) // Green
      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '👤 User', value: 'test@example.com' }),
          expect.objectContaining({ name: '💰 Subscription', value: 'premium' }),
          expect.objectContaining({ name: '🎫 License ID', value: 'license-456' }),
          expect.objectContaining({ name: '💳 Payment ID', value: 'pi_test_123' })
        ])
      )
    })

    it('should handle Discord API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      })

      const result = await provider.send(paidUserPayload)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Discord API error: 400 - Bad Request')
      expect(result.userId).toBe('user-123')
      expect(result.referenceId).toBe('paid_license_456')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await provider.send(paidUserPayload)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
      expect(result.userId).toBe('user-123')
    })
  })

  describe('send - new user notifications', () => {
    const newUserPayload: NotificationPayload = {
      type: 'new_user',
      user: {
        id: 'user-456',
        email: 'newuser@example.com',
        created_at: new Date('2024-01-15T09:00:00Z')
      } as NewUserRecord,
      referenceId: 'new_user_456_1705309200000',
      data: {
        created_at: new Date('2024-01-15T09:00:00Z')
      }
    }

    it('should format new user embed correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      await provider.send(newUserPayload)

      const callArgs = mockFetch.mock.calls?.[0]
      expect(callArgs).toBeDefined()
      const body = JSON.parse(callArgs![1].body)

      expect(body.embeds[0].title).toBe('👋 New User Joined!')
      expect(body.embeds[0].color).toBe(0x0099FF) // Blue
      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '👤 User', value: 'newuser@example.com' })
        ])
      )
    })
  })

  describe('send - inactive user notifications', () => {
    const inactiveUserPayload: NotificationPayload = {
      type: 'inactive_user',
      user: {
        id: 'user-789',
        email: 'inactive@example.com',
        last_activity: new Date('2024-01-08T10:00:00Z'),
        days_inactive: 7
      } as any,
      referenceId: 'inactive_user_789',
      data: {
        days_inactive: 7
      }
    }

    it('should format inactive user embed correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      await provider.send(inactiveUserPayload)

      const callArgs = mockFetch.mock.calls?.[0]
      expect(callArgs).toBeDefined()
      const body = JSON.parse(callArgs![1].body)

      expect(body.embeds[0].title).toBe('😴 Inactive User Alert')
      expect(body.embeds[0].color).toBe(0xFF9900) // Orange
      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '👤 User', value: 'inactive@example.com' })
        ])
      )
    })
  })

  describe('send - weekly report notifications', () => {
    const weeklyReportPayload: NotificationPayload = {
      type: 'weekly_report',
      user: {
        id: 'system',
        email: 'system@example.com'
      } as any,
      referenceId: 'weekly_2024_W03',
      data: {}
    }

    it('should format weekly report embed correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      await provider.send(weeklyReportPayload)

      const callArgs = mockFetch.mock.calls?.[0]
      expect(callArgs).toBeDefined()
      const body = JSON.parse(callArgs![1].body)

      expect(body.embeds[0].title).toBe('📊 Weekly Report Reminder')
      expect(body.embeds[0].color).toBe(0x9932CC) // Purple
    })
  })

  describe('send - unknown notification type', () => {
    const unknownPayload: NotificationPayload = {
      type: 'unknown_type' as any,
      user: {
        id: 'user-999',
        email: 'unknown@example.com'
      } as any,
      referenceId: 'unknown_999',
      data: {}
    }

    it('should handle unknown notification types with generic format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      await provider.send(unknownPayload)

      const callArgs = mockFetch.mock.calls?.[0]
      expect(callArgs).toBeDefined()
      const body = JSON.parse(callArgs![1].body)

      expect(body.embeds[0].title).toBe('🔔 Notification')
      expect(body.embeds[0].color).toBe(0x808080) // Gray
      expect(body.embeds[0].description).toContain('unknown_type event for user unknown@example.com')
    })
  })

  describe('send - paid user without optional fields', () => {
    const minimalPaidUserPayload: NotificationPayload = {
      type: 'paid_user',
      user: {
        id: 'user-minimal',
        email: 'minimal@example.com',
        subscription_status: 'paid',
        paid_at: new Date('2024-01-15T10:30:00Z')
      } as PaidUserRecord,
      referenceId: 'paid_minimal',
      data: {}
    }

    it('should handle paid user without license_id and stripe_payment_id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      await provider.send(minimalPaidUserPayload)

      const callArgs = mockFetch.mock.calls?.[0]
      expect(callArgs).toBeDefined()
      const body = JSON.parse(callArgs![1].body)

      // Should not include license ID or payment ID fields
      const fieldNames = body.embeds[0].fields.map((f: any) => f.name)
      expect(fieldNames).not.toContain('🎫 License ID')
      expect(fieldNames).not.toContain('💳 Payment ID')
      
      // Should still include basic fields
      expect(fieldNames).toContain('👤 User')
      expect(fieldNames).toContain('💰 Subscription')
    })
  })
})
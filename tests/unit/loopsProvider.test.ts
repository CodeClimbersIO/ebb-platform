import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { LoopsNotificationProvider } from '../../services/providers/LoopsNotificationProvider'
import type { NotificationPayload, BaseUserRecord } from '../../types/notifications'

// Store original fetch
const originalFetch = global.fetch
// Create a mock that maintains both fetch interface and mock methods
const mockFetch = mock() as unknown as typeof fetch & {
  mockClear(): void
  mockResolvedValueOnce(value: any): void
  mockRejectedValueOnce(value: any): void
  mock: { calls: any[] }
}

describe('LoopsNotificationProvider', () => {
  const mockApiKey = 'test-loops-api-key'
  const mockTemplates = {
    friend_request_existing_user: 'template_existing_123',
    friend_request_new_user: 'template_new_456',
    weekly_report: 'template_weekly_789'
  }
  let provider: LoopsNotificationProvider

  beforeEach(() => {
    global.fetch = mockFetch
    provider = new LoopsNotificationProvider(mockApiKey, mockTemplates)
    mockFetch.mockClear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('constructor', () => {
    it('should throw error if API key is not provided', () => {
      expect(() => new LoopsNotificationProvider('')).toThrow('Loops API key is required')
      expect(() => new LoopsNotificationProvider(undefined as unknown as string)).toThrow('Loops API key is required')
    })

    it('should create provider with valid API key', () => {
      expect(provider.name).toBe('email')
    })

    it('should work without templates parameter', () => {
      const basicProvider = new LoopsNotificationProvider(mockApiKey)
      expect(basicProvider.name).toBe('email')
    })
  })

  describe('send - friend request notifications', () => {
    const friendRequestPayload: NotificationPayload = {
      type: 'friend_request',
      user: {
        id: 'request-123',
        email: 'recipient@example.com'
      } as BaseUserRecord,
      referenceId: 'friend_request_123',
      data: {
        fromEmail: 'sender@example.com',
        requestId: 'request-123',
        existingUser: true
      }
    }

    it('should send friend request notification successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      })

      const result = await provider.send(friendRequestPayload)

      expect(result.success).toBe(true)
      expect(result.userId).toBe('request-123')
      expect(result.referenceId).toBe('friend_request_123')
      expect(result.channel).toBe('email')
      expect(result.message).toContain('Email notification sent successfully via Loops')
      expect(result.notificationId).toMatch(/loops_\d+_request-123/)
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('should use existing user template for existing users', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      })

      await provider.send(friendRequestPayload)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.loops.so/api/v1/transactional',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json'
          }
        })
      )

      const callArgs = mockFetch.mock.calls?.[0]
      expect(callArgs).toBeDefined()
      const body = JSON.parse(callArgs![1].body)

      expect(body.transactionalId).toBe('template_existing_123')
      expect(body.email).toBe('recipient@example.com')
      expect(body.dataVariables).toEqual({
        to_email: 'recipient@example.com',
        from_email: 'sender@example.com',
        request_id: 'request-123'
      })
    })

    it('should use new user template for new users', async () => {
      const newUserPayload = {
        ...friendRequestPayload,
        data: {
          ...friendRequestPayload.data,
          existingUser: false
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      })

      await provider.send(newUserPayload)

      const callArgs = mockFetch.mock.calls?.[0]
      const body = JSON.parse(callArgs![1].body)

      expect(body.transactionalId).toBe('template_new_456')
    })

    it('should use default template IDs when not configured', async () => {
      const basicProvider = new LoopsNotificationProvider(mockApiKey, {})

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      })

      await basicProvider.send(friendRequestPayload)

      const callArgs = mockFetch.mock.calls?.[0]
      const body = JSON.parse(callArgs![1].body)

      expect(body.transactionalId).toBe('cmc3u8e020700z00iason0m0f')
    })

    it('should handle Loops API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      })

      const result = await provider.send(friendRequestPayload)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Loops API error: 400 - Bad Request')
      expect(result.userId).toBe('request-123')
      expect(result.referenceId).toBe('friend_request_123')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await provider.send(friendRequestPayload)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
      expect(result.userId).toBe('request-123')
    })
  })

  describe('send - weekly report notifications', () => {
    const weeklyReportPayload: NotificationPayload = {
      type: 'weekly_report',
      user: {
        id: 'system',
        email: 'team@codeclimbers.io'
      } as BaseUserRecord,
      referenceId: 'weekly_2024_W03',
      data: {
        timestamp: '2024-01-15T09:00:00Z',
        totalUsers: 150,
        activeUsers: 120
      }
    }

    it('should send weekly report notification successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      })

      const result = await provider.send(weeklyReportPayload)

      expect(result.success).toBe(true)
      expect(result.userId).toBe('system')
      expect(result.channel).toBe('email')
    })

    it('should format weekly report email correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      })

      await provider.send(weeklyReportPayload)

      const callArgs = mockFetch.mock.calls?.[0]
      expect(callArgs).toBeDefined()
      const body = JSON.parse(callArgs![1].body)

      expect(body.transactionalId).toBe('template_weekly_789')
      expect(body.email).toBe('team@codeclimbers.io')
      expect(body.dataVariables).toEqual({
        timestamp: '2024-01-15T09:00:00Z',
        totalUsers: 150,
        activeUsers: 120
      })
    })

    it('should return error when weekly report template is not configured', async () => {
      const basicProvider = new LoopsNotificationProvider(mockApiKey, {})

      const result = await basicProvider.send(weeklyReportPayload)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No template configured')
      expect(result.message).toContain('No email template configured for weekly_report')
    })
  })

  describe('send - unsupported notification types', () => {
    const unsupportedPayload: NotificationPayload = {
      type: 'paid_user',
      user: {
        id: 'user-123',
        email: 'test@example.com'
      } as BaseUserRecord,
      referenceId: 'paid_user_123',
      data: {}
    }

    it('should return error for unsupported notification types', async () => {
      const result = await provider.send(unsupportedPayload)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No template configured')
      expect(result.message).toContain('No email template configured for paid_user')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})

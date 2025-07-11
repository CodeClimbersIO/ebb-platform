import { describe, it, expect } from 'bun:test'
import { NotificationService } from '../NotificationService'

describe('NotificationService', () => {
  describe('generateReferenceId', () => {
    it('should generate a reference ID for a paid user', () => {
      const referenceId = NotificationService.generateReferenceId('paid_user', '123', { license_id: '456' })
      expect(referenceId).toBe('paid_license_456')
    })

    it('should generate a reference ID for a new user', () => {
      const referenceId = NotificationService.generateReferenceId('new_user', '123', { created_at: new Date('2021-01-01') })
      expect(referenceId).toBe('new_123_1609459200000')
    })

    it('should generate a reference ID for a weekly report', () => {
      const referenceId = NotificationService.generateReferenceId('weekly_report', '123')
      expect(referenceId).toContain('weekly_')
    })

    it('should generate a reference ID for a paid user with no license ID', () => {
      const referenceId = NotificationService.generateReferenceId('paid_user', '123', { paid_at: new Date('2021-01-01') })
      expect(referenceId).toBe('paid_123_1609459200000')
    })
  })
})
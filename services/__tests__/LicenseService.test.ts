import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { LicenseService } from "../LicenseService"
import { LicenseRepo, type License } from "../../repos/License"

// Mock the LicenseRepo module
mock.module("../../repos/License", () => ({
  LicenseRepo: {
    getActiveLicenseByUserId: mock(),
    createLicense: mock()
  }
}))

const mockLicense = {

  id: 'license-123',
  user_id: 'test-user-id',
  license_type: 'free_trial',
  status: 'active',
  expiration_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
} as License
describe('LicenseService', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mock.restore()
  })

  describe('startFreeTrial', () => {
    it('should throw error when user already has an active license', async () => {
      // Mock getActiveLicenseByUserId to return an existing license
      LicenseRepo.getActiveLicenseByUserId = mock(() => Promise.resolve(mockLicense))

      await expect(LicenseService.startFreeTrial('test-user-id')).rejects.toThrow('User already has a license')
      
      expect(LicenseRepo.getActiveLicenseByUserId).toHaveBeenCalledWith('test-user-id')
    })
    it('should start a free trial when user has no existing license', async () => {
      LicenseRepo.getActiveLicenseByUserId = mock(() => Promise.resolve(null))
      LicenseRepo.createLicense = mock(() => Promise.resolve(mockLicense))
      const result = await LicenseService.startFreeTrial('test-user-id')
      expect(result).toBeDefined()
      expect(LicenseRepo.getActiveLicenseByUserId).toHaveBeenCalledWith('test-user-id')
      expect(LicenseRepo.createLicense).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        license_type: 'free_trial',
        expiration_date: expect.any(Date)
      })
    })
  })
})
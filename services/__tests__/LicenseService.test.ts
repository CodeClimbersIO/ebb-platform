import { describe, it, expect, afterEach, mock, spyOn } from 'bun:test'
import { LicenseService } from "../LicenseService"
import { LicenseRepo, type License } from "../../repos/License"

// Use spies rather than mock.module: Bun applies mock.module to every test file
// in the run, so a module-level stub here would leak into later files.

const mockLicense = {
  id: 'license-123',
  user_id: 'test-user-id',
  license_type: 'free_trial',
  status: 'active',
  expiration_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
} as License

describe('LicenseService', () => {
  afterEach(() => {
    // Restore all spies so LicenseRepo is untouched for other test files
    mock.restore()
  })

  describe('startFreeTrial', () => {
    it('should throw error when user already has a license', async () => {
      const getLicenseByUserId = spyOn(LicenseRepo, 'getLicenseByUserId').mockResolvedValue(mockLicense)

      await expect(LicenseService.startFreeTrial('test-user-id')).rejects.toThrow('User already has a license')

      expect(getLicenseByUserId).toHaveBeenCalledWith('test-user-id')
    })

    it('should start a free trial when user has no existing license', async () => {
      const getLicenseByUserId = spyOn(LicenseRepo, 'getLicenseByUserId').mockResolvedValue(null)
      const createLicense = spyOn(LicenseRepo, 'createLicense').mockResolvedValue(mockLicense)

      const result = await LicenseService.startFreeTrial('test-user-id')

      expect(result).toBeDefined()
      expect(getLicenseByUserId).toHaveBeenCalledWith('test-user-id')
      expect(createLicense).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        license_type: 'free_trial',
        expiration_date: expect.any(Date)
      })
    })
  })
})

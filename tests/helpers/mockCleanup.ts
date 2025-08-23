import { UserProfileRepo } from '../../repos/UserProfile'
import { LicenseRepo } from '../../repos/License'

// Store original methods at module load time
const originalMethods = {
  UserProfileRepo: {
    getUserStatusCounts: UserProfileRepo.getUserStatusCounts,
  },
  LicenseRepo: {
    getLicenseByUserId: LicenseRepo.getLicenseByUserId,
    createLicense: LicenseRepo.createLicense,
  },
}

/**
 * Restores all repository methods to their original implementations
 * Should be called between test files to ensure clean state
 */
export const restoreAllMocks = () => {
  UserProfileRepo.getUserStatusCounts = originalMethods.UserProfileRepo.getUserStatusCounts
  LicenseRepo.getLicenseByUserId = originalMethods.LicenseRepo.getLicenseByUserId
  LicenseRepo.createLicense = originalMethods.LicenseRepo.createLicense
}
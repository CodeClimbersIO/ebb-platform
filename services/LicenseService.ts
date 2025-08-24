import { LicenseRepo } from "../repos/License"

export const LicenseService = {
  async getActiveLicense(userId: string) {
    return LicenseRepo.getActiveLicenseByUserId(userId)
  }
}
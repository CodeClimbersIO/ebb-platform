import { LicenseRepo } from "../repos/License"
import { ApiError } from "../middleware/errorHandler.js"

const getActiveLicense = async (userId: string) => {
  return LicenseRepo.getActiveLicenseByUserId(userId)
}

const startFreeTrial = async (userId: string) => {
  const existingLicense = await LicenseRepo.getActiveLicenseByUserId(userId)
  if (existingLicense) {
    throw new ApiError('User already has a license', 422)
  }

  const expirationDate = new Date()
  expirationDate.setDate(expirationDate.getDate() + 14)

  return LicenseRepo.createLicense({
    user_id: userId,
    license_type: 'free_trial',
    expiration_date: expirationDate
  })
}

export const LicenseService = {
  getActiveLicense,
  startFreeTrial
}
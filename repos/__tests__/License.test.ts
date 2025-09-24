import { describe, it, expect, beforeAll } from 'bun:test'
import { randomUUID } from 'crypto'
import { getDb } from '../../config/database'
import { LicenseRepo, type License, type LicenseStatus } from '../License'

describe('LicenseRepo', () => {
  let user1Id: string
  let defaultLicense: License

  beforeAll(async () => {
    
    user1Id = randomUUID()
    const db = getDb()
    await db('auth.users').insert({ id: user1Id, email: 'test@license.com' })
    const licenseData = {
      id: randomUUID(),
      user_id: user1Id,
      license_type: 'subscription' as const,
      status: 'active' as const,
      purchase_date: new Date(),
      expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      stripe_customer_id: 'cus_test123',
      stripe_payment_id: 'pi_test123',
      created_at: new Date(),
      updated_at: new Date()
    }
    await db('license').insert(licenseData)
    defaultLicense = licenseData
  })

  describe('getActiveLicenseByUserId', () => {
    it('should return null when no active license exists for user', async () => {
      const userId = randomUUID()
      const result = await LicenseRepo.getActiveLicenseByUserId(userId)
      expect(result).toBeNull()
    })

    it('should return the active license when user has an active license', async () => {
      const result = await LicenseRepo.getActiveLicenseByUserId(user1Id)
      expect(result).toBeDefined()
      expect(result?.user_id).toBe(user1Id)
      expect(result?.status).toBe('active')
    })
    it('should return the active license when user has an active license and expiration date is null', async () => {
      const db = getDb()
      await db('license').update({ expiration_date: null }).where({ user_id: user1Id })
      const result = await LicenseRepo.getActiveLicenseByUserId(user1Id)
      expect(result).toBeDefined()
      expect(result?.user_id).toBe(user1Id)
      expect(result?.status).toBe('active')
    })

    it('should filter out inactive licenses', async () => {
      const db = getDb()
      await db('license').update({ status: 'expired' }).where({ user_id: user1Id })
      const result = await LicenseRepo.getActiveLicenseByUserId(user1Id)
      expect(result).toBeNull()
    })

    it('should filter out expired licenses even if status is active', async () => {
      const db = getDb()
      const expiredUserId = randomUUID()
      await db('auth.users').insert({ id: expiredUserId, email: 'expired@test.com' })
      
      // Create a license with active status but expired date
      await db('license').insert({
        id: randomUUID(),
        user_id: expiredUserId,
        license_type: 'subscription',
        status: 'active',
        purchase_date: new Date(),
        expiration_date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        created_at: new Date(),
        updated_at: new Date()
      })

      const result = await LicenseRepo.getActiveLicenseByUserId(expiredUserId)
      expect(result).toBeNull()
    })

    it('should return license that expires in the future', async () => {
      const db = getDb()
      const futureUserId = randomUUID()
      await db('auth.users').insert({ id: futureUserId, email: 'future@test.com' })
      
      // Create a license with active status and future expiration
      const futureExpiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      await db('license').insert({
        id: randomUUID(),
        user_id: futureUserId,
        license_type: 'subscription',
        status: 'active',
        purchase_date: new Date(),
        expiration_date: futureExpiration,
        created_at: new Date(),
        updated_at: new Date()
      })

      const result = await LicenseRepo.getActiveLicenseByUserId(futureUserId)
      expect(result).not.toBeNull()
      expect(result?.user_id).toBe(futureUserId)
      expect(new Date(result?.expiration_date || '')).toEqual(futureExpiration)
    })
  })
  

  describe('updateLicenseByStripePaymentId', () => {
    it('should update a license', async () => {
      const result = await LicenseRepo.updateLicenseByStripePaymentId('pi_test123', 'expired')
      expect(result).not.toBeNull()
      expect(result?.user_id).toBe(user1Id)
      expect(result?.status).toBe('expired')
    })
  })
})
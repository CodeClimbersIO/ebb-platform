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


  describe('getLicenseByUserId', () => {
    it('should return null when no license exists for user', async () => {
      const userId = randomUUID()
      const result = await LicenseRepo.getLicensesByUserId(userId)
      
      expect(result).toEqual([])
    })

    it('should return license when user has a license', async () => {
      
      const result = await LicenseRepo.getLicensesByUserId(user1Id)
      
      expect(result.length).toBe(1)
      const [license] = result
      expect(license).toBeDefined()
      expect(license?.user_id).toBe(user1Id)
      expect(license?.license_type).toBe(defaultLicense.license_type)
      expect(license?.status).toBe(defaultLicense.status as LicenseStatus)
      expect(license?.stripe_customer_id).toBe(defaultLicense.stripe_customer_id as string)
    })

    it('should handle database errors gracefully', async () => {
      // Test with invalid UUID format
      expect(() => LicenseRepo.getLicensesByUserId('invalid-uuid')).toThrow()
    })
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

    it('should filter out inactive licenses', async () => {
      const db = getDb()
      await db('license').update({ status: 'expired' }).where({ user_id: user1Id })
      const result = await LicenseRepo.getActiveLicenseByUserId(user1Id)
      expect(result).toBeNull()
    })
  })
  // describe('upsertLicense', () => {
  //   it('should upsert a license', async () => {
  //     const license = await LicenseRepo.upsertLicense({
  //       user_id: user1Id,
  //       license_type: 'subscription',
  //       status: 'active',
  //       expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  //     })
  // })
})
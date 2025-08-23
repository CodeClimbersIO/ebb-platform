import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { startTestDatabase, stopTestDatabase, resetTestDatabase, getTestDatabase } from '../../tests/helpers/testDatabase'
import { randomUUID } from 'crypto'

describe('LicenseRepo', () => {
  let LicenseRepo: any

  beforeAll(async () => {
    await startTestDatabase()
    // Import after test database is set up to ensure it uses the test connection
    const { LicenseRepo: ImportedLicenseRepo } = await import('../License')
    LicenseRepo = ImportedLicenseRepo
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  beforeEach(async () => {
    await resetTestDatabase()
  })

  describe('getLicenseByUserId', () => {
    it('should return null when no license exists for user', async () => {
      const userId = randomUUID()
      const result = await LicenseRepo.getLicenseByUserId(userId)
      
      expect(result).toBeNull()
    })

    it('should return license when user has a license', async () => {
      const db = getTestDatabase()
      const userId = randomUUID()
      
      // Insert user first (required for foreign key)
      await db('auth.users').insert({ id: userId })
      
      const licenseData = {
        id: randomUUID(),
        user_id: userId,
        license_type: 'subscription' as const,
        status: 'active' as const,
        purchase_date: new Date(),
        expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        stripe_customer_id: 'cus_test123',
        stripe_payment_id: 'pi_test123',
        created_at: new Date(),
        updated_at: new Date()
      }

      // Insert test license directly into database
      await db('license').insert(licenseData)

      const result = await LicenseRepo.getLicenseByUserId(userId)
      
      expect(result).toBeDefined()
      expect(result).not.toBeNull()
      expect(result?.user_id).toBe(userId)
      expect(result?.license_type).toBe('subscription')
      expect(result?.status).toBe('active')
      expect(result?.stripe_customer_id).toBe('cus_test123')
    })

    it('should return license for different license types', async () => {
      const db = getTestDatabase()
      const userId1 = randomUUID()
      const userId2 = randomUUID()
      
      // Insert users first
      await db('auth.users').insert([{ id: userId1 }, { id: userId2 }])
      
      // Insert perpetual license
      await db('license').insert({
        id: randomUUID(),
        user_id: userId1,
        license_type: 'perpetual',
        status: 'active',
        purchase_date: new Date(),
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        created_at: new Date(),
        updated_at: new Date()
      })

      // Insert subscription license
      await db('license').insert({
        id: randomUUID(),
        user_id: userId2,
        license_type: 'subscription',
        status: 'expired',
        purchase_date: new Date('2023-01-01'),
        expiration_date: new Date('2023-12-31'),
        created_at: new Date(),
        updated_at: new Date()
      })

      const perpetualResult = await LicenseRepo.getLicenseByUserId(userId1)
      const subscriptionResult = await LicenseRepo.getLicenseByUserId(userId2)
      
      expect(perpetualResult?.license_type).toBe('perpetual')
      expect(perpetualResult?.status).toBe('active')
      
      expect(subscriptionResult?.license_type).toBe('subscription')
      expect(subscriptionResult?.status).toBe('expired')
    })

    it('should handle database errors gracefully', async () => {
      // Test with invalid UUID format
      expect(() => LicenseRepo.getLicenseByUserId('invalid-uuid')).toThrow()
    })
  })
})
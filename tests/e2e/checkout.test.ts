import { describe, it, expect } from 'bun:test'
import request from 'supertest'
import app from '../../index'
import { StripeService } from '../../services/StripeService'
import { LicenseService } from '../../services/LicenseService'

StripeService.createCheckoutSession = async () => 'https://checkout.stripe.com/test-session'

describe('Checkout API', () => {
  describe('POST /api/checkout/create', () => {
    describe('Authentication Required', () => {
      it('should return 401 when no authorization header is provided', async () => {
        const response = await request(app)
          .post('/api/checkout/create')
          .send({ licenseType: 'monthly_subscription' })
          .expect(401)

        expect(response.body).toEqual({
          success: false,
          error: 'Access token required'
        })
      })

      it('should return 401 when token is invalid', async () => {
        const response = await request(app)
          .post('/api/checkout/create')
          .set('Authorization', 'Bearer invalid_token')
          .send({ licenseType: 'monthly_subscription' })
          .expect(401)

        expect(response.body).toEqual({
          success: false,
          error: 'Invalid or expired token'
        })
      })
    })

    describe('Request Validation', () => {
      it('should return 422 when licenseType is missing', async () => {
        const response = await request(app)
          .post('/api/checkout/create')
          .set('Authorization', 'Bearer valid_test_token')
          .send({})
          .expect(422)

        expect(response.body.success).toBe(false)
        expect(response.body.error).toContain('licenseType is required')
      })

      it('should return 422 when licenseType is invalid', async () => {
        const response = await request(app)
          .post('/api/checkout/create')
          .set('Authorization', 'Bearer valid_test_token')
          .send({ licenseType: 'invalid_license_type' })
          .expect(422)

        expect(response.body.success).toBe(false)
        expect(response.body.error).toContain('Invalid licenseType:')
      })

      it('should accept valid monthly subscription product ID', async () => {
        let originalGetLicenseByUserId = LicenseService.getActiveLicense
        let originalCreateCheckoutSession = StripeService.createCheckoutSession

        LicenseService.getActiveLicense = async () => null
        StripeService.createCheckoutSession = async () => 'https://checkout.stripe.com/test-session'

        const response = await request(app)
          .post('/api/checkout/create')
          .set('Authorization', 'Bearer valid_test_token')
          .send({ licenseType: 'monthly_subscription' })
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveProperty('url')

        LicenseService.getActiveLicense = originalGetLicenseByUserId
        StripeService.createCheckoutSession = originalCreateCheckoutSession
      })

      it('should accept valid annual subscription product ID', async () => {
        let originalGetLicenseByUserId = LicenseService.getActiveLicense
        let originalCreateCheckoutSession = StripeService.createCheckoutSession

        LicenseService.getActiveLicense = async () => null
        StripeService.createCheckoutSession = async () => 'https://checkout.stripe.com/test-session'

        const response = await request(app)
          .post('/api/checkout/create')
          .set('Authorization', 'Bearer valid_test_token')
          .send({ licenseType: 'annual_subscription' })
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveProperty('url')

        LicenseService.getActiveLicense = originalGetLicenseByUserId
        StripeService.createCheckoutSession = originalCreateCheckoutSession
      })
    })

    describe('return validation', () => {
      it('should return 200 when licenseType is valid', async () => {


        const response = await request(app)
          .post('/api/checkout/create')
          .set('Authorization', 'Bearer valid_test_token')
          .send({ licenseType: 'monthly_subscription' })
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveProperty('url')
      })
    })

    describe('CORS Support', () => {
      it('should handle OPTIONS requests for CORS preflight', async () => {
        await request(app)
          .options('/api/checkout/create')
          .expect(200)
      })

      it('should include proper CORS headers on OPTIONS', async () => {
        const response = await request(app)
          .options('/api/checkout/create')
          .expect(200)

        expect(response.headers['access-control-allow-origin']).toBe('*')
        expect(response.headers['access-control-allow-methods']).toContain('POST')
        expect(response.headers['access-control-allow-headers']).toContain('Authorization')
      })
    })
  })
})
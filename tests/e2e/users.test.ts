import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import request from 'supertest'
import app from '../../index'
import { UserProfileRepo } from '../../repos/UserProfile'
import { LicenseRepo } from '../../repos/License'

describe('Users API', () => {
  describe('GET /api/users/status-counts', () => {
    describe('Authentication Required', () => {
      it('should return 401 when no authorization header is provided', async () => {
        const response = await request(app)
          .get('/api/users/status-counts')
          .expect(401)

        expect(response.body).toEqual({
          success: false,
          error: 'Access token required'
        })
      })

      it('should return 401 when authorization header is malformed', async () => {
        const response = await request(app)
          .get('/api/users/status-counts')
          .set('Authorization', 'InvalidFormat')
          .expect(401)

        expect(response.body).toEqual({
          success: false,
          error: 'Access token required'
        })
      })

      it('should return 401 when token is invalid', async () => {
        const response = await request(app)
          .get('/api/users/status-counts')
          .set('Authorization', 'Bearer invalid_token')
          .expect(401)

        expect(response.body).toEqual({
          success: false,
          error: 'Invalid or expired token'
        })
      })

      it('should return JSON content type for auth errors', async () => {
        const response = await request(app)
          .get('/api/users/status-counts')
          .expect(401)

        expect(response.headers['content-type']).toMatch(/application\/json/)
      })

      it('should include CORS headers even for auth errors', async () => {
        const response = await request(app)
          .get('/api/users/status-counts')
          .expect(401)

        expect(response.headers['access-control-allow-origin']).toBe('*')
        expect(response.headers['access-control-allow-methods']).toContain('GET')
      })
    })

    describe('Successful Authentication (Mock)', () => {
      let originalGetUserStatusCounts: typeof UserProfileRepo.getUserStatusCounts

      beforeEach(() => {
        // Store original method and mock it for successful auth tests
        originalGetUserStatusCounts = UserProfileRepo.getUserStatusCounts
        UserProfileRepo.getUserStatusCounts = async () => []
      })

      afterEach(() => {
        // Restore original method
        UserProfileRepo.getUserStatusCounts = originalGetUserStatusCounts
      })

      it('should return 200 with valid test token', async () => {
        const response = await request(app)
          .get('/api/users/status-counts')
          .set('Authorization', 'Bearer valid_test_token')
          .expect(200)

        expect(response.body).toHaveProperty('success', true)
        expect(response.body).toHaveProperty('data')
        expect(response.body.data).toEqual({
          online: 0,
          offline: 0,
          active: 0,
          flowing: 0
        })
      })

      it('should include CORS headers on successful requests', async () => {
        const response = await request(app)
          .get('/api/users/status-counts')
          .set('Authorization', 'Bearer valid_test_token')
          .expect(200)

        expect(response.headers['access-control-allow-origin']).toBe('*')
        expect(response.headers['access-control-allow-methods']).toContain('GET')
      })

      it('should return JSON content type for successful requests', async () => {
        const response = await request(app)
          .get('/api/users/status-counts')
          .set('Authorization', 'Bearer valid_test_token')
          .expect(200)

        expect(response.headers['content-type']).toMatch(/application\/json/)
      })

      it('should have consistent success response structure', async () => {
        const response = await request(app)
          .get('/api/users/status-counts')
          .set('Authorization', 'Bearer valid_test_token')
          .expect(200)

        expect(response.body).toHaveProperty('success', true)
        expect(response.body).toHaveProperty('data')
        expect(typeof response.body.data).toBe('object')
        
        // Check that all expected status types are present
        const expectedStatuses = ['online', 'offline', 'active', 'flowing']
        expectedStatuses.forEach(status => {
          expect(response.body.data).toHaveProperty(status)
          expect(typeof response.body.data[status]).toBe('number')
        })
      })
    })

    describe('Endpoint Requirements', () => {
      it('should be a GET endpoint', async () => {
        // Test that POST is not allowed
        await request(app)
          .post('/api/users/status-counts')
          .expect(404) // Should get 404 as POST route doesn't exist
      })

      it('should be under /api/users path', async () => {
        // Test that the endpoint is properly routed
        await request(app)
          .get('/users/status-counts')
          .expect(404) // Should get 404 as it's not under /api
      })
    })

    describe('Error Response Format', () => {
      it('should have consistent error response structure', async () => {
        const response = await request(app)
          .get('/api/users/status-counts')
          .expect(401)

        expect(response.body).toHaveProperty('success', false)
        expect(response.body).toHaveProperty('error')
        expect(typeof response.body.error).toBe('string')
        expect(response.body.error.length).toBeGreaterThan(0)
      })
    })
  })

  describe('General API Behavior', () => {
    it('should handle OPTIONS requests for CORS preflight', async () => {
      await request(app)
        .options('/api/users/status-counts')
        .expect(200)
    })

    it('should include proper CORS headers on OPTIONS', async () => {
      const response = await request(app)
        .options('/api/users/status-counts')
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-methods']).toContain('GET')
      expect(response.headers['access-control-allow-headers']).toContain('Authorization')
    })
  })
}) 

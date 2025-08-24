import { describe, it, expect } from 'bun:test'
import request from 'supertest'
import app from '../../index'

describe('General Routes', () => {
  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404)

      expect(response.body).toEqual({
        success: false,
        error: 'Route not found'
      })
    })

    it('should return 404 for unknown API routes', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .expect(404)

      expect(response.body).toEqual({
        success: false,
        error: 'Route not found'
      })
    })

    it('should return JSON content type for 404', async () => {
      const response = await request(app)
        .get('/unknown')
        .expect(404)

      expect(response.headers['content-type']).toMatch(/application\/json/)
    })
  })

  describe('CORS preflight', () => {
    it('should handle OPTIONS request for any route', async () => {
      await request(app)
        .options('/any-route')
        .expect(200)
    })

    it('should include proper CORS headers on OPTIONS', async () => {
      const response = await request(app)
        .options('/test')
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-methods']).toContain('GET')
      expect(response.headers['access-control-allow-methods']).toContain('POST')
      expect(response.headers['access-control-allow-headers']).toContain('Authorization')
    })
  })
}) 

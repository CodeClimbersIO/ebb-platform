import { describe, it, expect } from 'bun:test'
import request from 'supertest'
import app from '../../index'

describe('Health Check API', () => {
  describe('GET /health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body.status).toEqual('OK')
      expect(response.body.timestamp).toBeDefined()

      expect(() => new Date(response.body.timestamp)).not.toThrow()
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp)
    })

    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.headers['content-type']).toMatch(/application\/json/)
    })

    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-methods']).toContain('GET')
    })

    it('should respond to OPTIONS request', async () => {
      await request(app)
        .options('/health')
        .expect(200)
    })
  })
}) 

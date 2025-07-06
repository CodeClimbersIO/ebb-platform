import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'
import app from '../../index'
import { startTestServer, stopTestServer } from '../helpers/testServer'

describe('Marketing API', () => {
  beforeAll(async () => {
    await startTestServer()
  })

  afterAll(async () => {
    await stopTestServer()
  })

  describe('GET /api/marketing/weekly-activity', () => {
    it('should return 200 and weekly activity data', async () => {
      const response = await request(app)
        .get('/api/marketing/weekly-activity')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(Array.isArray(response.body.data)).toBe(true)
      
      // If there's data, verify structure
      if (response.body.data.length > 0) {
        const firstItem = response.body.data[0]
        expect(firstItem).toHaveProperty('week_start')
        expect(firstItem).toHaveProperty('total_hours')
        expect(typeof firstItem.week_start).toBe('string')
        expect(typeof firstItem.total_hours).toBe('number')
      }
    })

    it('should not require authentication', async () => {
      const response = await request(app)
        .get('/api/marketing/weekly-activity')
        .expect(200)
      
      expect(response.body.success).toBe(true)
    })
  })

  describe('GET /api/marketing/total-hours', () => {
    it('should return 200 and total hours creating', async () => {
      const response = await request(app)
        .get('/api/marketing/total-hours')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data).toHaveProperty('total_hours')
      expect(typeof response.body.data.total_hours).toBe('number')
    })

    it('should not require authentication', async () => {
      const response = await request(app)
        .get('/api/marketing/total-hours')
        .expect(200)
      
      expect(response.body.success).toBe(true)
    })
  })

  describe('GET /api/marketing/average-weekly-hours', () => {
    it('should return 200 and average weekly hours', async () => {
      const response = await request(app)
        .get('/api/marketing/average-weekly-hours')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data).toHaveProperty('average_weekly_hours')
      expect(typeof response.body.data.average_weekly_hours).toBe('number')
    })

    it('should not require authentication', async () => {
      const response = await request(app)
        .get('/api/marketing/average-weekly-hours')
        .expect(200)
      
      expect(response.body.success).toBe(true)
    })
  })

  describe('GET /api/marketing/daily-activity', () => {
    it('should return 200 and daily activity data', async () => {
      const response = await request(app)
        .get('/api/marketing/daily-activity')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(Array.isArray(response.body.data)).toBe(true)
      
      // If there's data, verify structure
      if (response.body.data.length > 0) {
        const firstItem = response.body.data[0]
        expect(firstItem).toHaveProperty('date')
        expect(firstItem).toHaveProperty('total_minutes')
        expect(typeof firstItem.date).toBe('string')
        expect(typeof firstItem.total_minutes).toBe('number')
      }
    })

    it('should accept days query parameter', async () => {
      const response = await request(app)
        .get('/api/marketing/daily-activity?days=30')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    it('should not require authentication', async () => {
      const response = await request(app)
        .get('/api/marketing/daily-activity')
        .expect(200)
      
      expect(response.body.success).toBe(true)
    })
  })

  describe('GET /api/marketing/top-creating-days', () => {
    it('should return 200 and top creating days', async () => {
      const response = await request(app)
        .get('/api/marketing/top-creating-days')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(Array.isArray(response.body.data)).toBe(true)
      
      // If there's data, verify structure
      if (response.body.data.length > 0) {
        const firstItem = response.body.data[0]
        expect(firstItem).toHaveProperty('date')
        expect(firstItem).toHaveProperty('total_hours')
        expect(typeof firstItem.date).toBe('string')
        expect(typeof firstItem.total_hours).toBe('number')
      }
    })

    it('should accept limit query parameter', async () => {
      const response = await request(app)
        .get('/api/marketing/top-creating-days?limit=5')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    it('should not require authentication', async () => {
      const response = await request(app)
        .get('/api/marketing/top-creating-days')
        .expect(200)
      
      expect(response.body.success).toBe(true)
    })
  })

  describe('GET /api/marketing/cache-status', () => {
    it('should return 200 and cache status', async () => {
      // First make some requests to populate cache
      await request(app).get('/api/marketing/total-hours')
      await request(app).get('/api/marketing/weekly-activity')
      
      const response = await request(app)
        .get('/api/marketing/cache-status')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data).toHaveProperty('size')
      expect(response.body.data).toHaveProperty('items')
      expect(Array.isArray(response.body.data.items)).toBe(true)
      expect(response.body.data.size).toBeGreaterThan(0)
      
      // Check structure of cache items
      if (response.body.data.items.length > 0) {
        const firstItem = response.body.data.items[0]
        expect(firstItem).toHaveProperty('key')
        expect(firstItem).toHaveProperty('ageMinutes')
        expect(firstItem).toHaveProperty('ttlMinutes')
        expect(firstItem).toHaveProperty('isExpiringSoon')
      }
    })

    it('should not require authentication', async () => {
      const response = await request(app)
        .get('/api/marketing/cache-status')
        .expect(200)
      
      expect(response.body.success).toBe(true)
    })
  })

  describe('General Marketing API Tests', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/marketing/total-hours')
        .expect(200)

      expect(response.headers['content-type']).toMatch(/application\/json/)
    })

    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/marketing/total-hours')
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-methods']).toContain('GET')
    })

    it('should respond to OPTIONS request', async () => {
      await request(app)
        .options('/api/marketing/total-hours')
        .expect(200)
    })
  })
}) 
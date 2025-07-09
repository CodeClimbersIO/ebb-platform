import Redis from 'ioredis'

const REDIS_HOST = process.env.REDIS_HOST || 'localhost'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379')
const REDIS_PASSWORD = process.env.REDIS_PASSWORD
const REDIS_DB = parseInt(process.env.REDIS_DB || '0')

// Redis connection configuration
export const redisConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetries: 3,
  lazyConnect: true,
}

// Create Redis instance for BullMQ
export const createRedisConnection = () => {
  const redis = new Redis(redisConfig)
  
  redis.on('connect', () => {
    console.log('✅ Redis connected successfully')
  })
  
  redis.on('error', (error: Error) => {
    console.error('❌ Redis connection error:', error)
  })
  
  redis.on('close', () => {
    console.log('🔄 Redis connection closed')
  })
  
  return redis
}

// Export default Redis instance
export const redis = createRedisConnection() 
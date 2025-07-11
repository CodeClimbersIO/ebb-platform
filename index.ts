import express, { json, urlencoded } from 'express'
import { UserController } from './controllers/UserController'
import { GeoLocationController } from './controllers/GeoLocationController'
import { FriendsController } from './controllers/FriendsController'
import { RollupController } from './controllers/RollupController'
import { MarketingController } from './controllers/MarketingController'
import { JobQueueController } from './controllers/JobQueueController'
import { NotificationTestController } from './controllers/NotificationTestController'
import { GeoLocationService } from './services/GeoLocationService'
import { jobQueueService } from './services/JobQueueService'
import { ApiError } from './middleware/errorHandler'

const app = express()
const PORT = parseInt(process.env.PORT || '8001', 10)

// Middleware
app.use(json())
app.use(urlencoded({ extended: true }))

// CORS middleware (basic setup)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Ebb Platform API'
  })
})

// API Routes (protected by authentication middleware)
app.use('/api/users', UserController.router)
app.use('/api/geolocation', GeoLocationController.router)
app.use('/api/friends', FriendsController.router)
app.use('/api/rollup', RollupController.router)
app.use('/api/jobs', JobQueueController.router)
app.use('/api/notifications', NotificationTestController.router)

// Public API Routes (no authentication required)
app.use('/api/marketing', MarketingController.router)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  })
})

// Error handler - Fixed signature with next parameter
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Don't log expected authentication errors during tests
  const isTestMode = process.env.NODE_ENV === 'test'
  const isAuthError = err instanceof ApiError && [401, 403].includes(err.statusCode)
  
  if (!isTestMode || !isAuthError) {
    console.error('Unhandled error:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    })
  }
  
  // Handle custom API errors
  if (err instanceof ApiError) {
    const isDevelopment = process.env.NODE_ENV === 'development'
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(isDevelopment && { details: err.message, stack: err.stack })
    })
    return
  }
  
  // Handle other errors
  const isDevelopment = process.env.NODE_ENV === 'development'
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(isDevelopment && { details: err.message, stack: err.stack })
  })
})

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  })
  
  // In production, we might want to restart the process
  // For now, we'll just log and continue
  if (process.env.NODE_ENV === 'production') {
    console.error('Server encountered an uncaught exception but will continue running')
  }
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  console.error('Timestamp:', new Date().toISOString())
})

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...')
  await gracefulShutdown()
})

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...')
  await gracefulShutdown()
})

async function gracefulShutdown() {
  try {
    await jobQueueService.shutdown()
    console.log('✅ Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error)
    process.exit(1)
  }
}

// Function to start the server
export const startServer = async (port: number = PORT) => {
  try {
    // Initialize services
    console.log('🔧 Initializing services...')
    
    // Initialize GeoLocationService (will fail gracefully if database not found)
    try {
      await GeoLocationService.initialize()
    } catch (error) {
      console.warn('⚠️  GeoLocationService initialization failed:', error)
      console.warn('   Geolocation features will not be available.')
      console.warn('   To enable geolocation, set GEOIP_DATABASE_PATH environment variable.')
    }
    
    // Initialize Job Queue Service (will fail gracefully if Redis not available)
    try {
      await jobQueueService.initialize()
    } catch (error) {
      console.warn('⚠️  Job Queue Service initialization failed:', error)
      console.warn('   Scheduled user monitoring jobs will not be available.')
      console.warn('   To enable job queue, ensure Redis is running and properly configured.')
    }
    
    console.log('✅ Services initialized successfully')
    
    return app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`)
      console.log(`📊 Health check: http://localhost:${port}/health`)
      console.log(`👥 Users API (auth required): http://localhost:${port}/api/users`)
      console.log(`🌍 Geolocation API (auth required): http://localhost:${port}/api/geolocation`)
      console.log(`👋 Friends API (auth required): http://localhost:${port}/api/friends`)
      console.log(`🏭 Rollup API (auth required): http://localhost:${port}/api/rollup`)
      console.log(`📈 Marketing API (public): http://localhost:${port}/api/marketing`)
      console.log(`⚙️  Job Queue API (auth required): http://localhost:${port}/api/jobs`)
      console.log(`⚙️  Job Queue: User monitoring jobs scheduled (requires Redis)`)
      console.log('🔐 Authentication: Supabase JWT required for /api routes (except marketing)')
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Auto-start server only when this file is run directly
if (import.meta.main) {
  startServer()
}

export default app

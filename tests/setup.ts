// Test environment setup
import { afterAll, beforeAll } from 'bun:test'
import { startTestDatabase, resetTestDatabase } from './helpers/testDatabase'
import { startTestServer, stopTestServer } from './helpers/testServer'
import { stopDb } from '../config/database'

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.PORT = '3002'

  // Suppress console logs during tests for cleaner output
  // You can set SUPPRESS_TEST_LOGS=false to see logs if needed for debugging
  console.log('🧪 Test environment initialized')

  await startTestServer()
  await startTestDatabase()

})

afterAll(async () => {
  console.log('🧪 Test environment stopped')
  // Only reset data between test files, keep connection alive
  await resetTestDatabase()
  await stopTestServer()
})

// Ensure cleanup happens when test run completes
const cleanup = async () => {
  console.log('🧹 Cleaning up database connection...')
  stopDb()
}

// Register cleanup handlers for process exit
process.on('exit', () => {
  cleanup()
})

process.on('SIGINT', async () => {
  await cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await cleanup()
  process.exit(0)
})

export {} 

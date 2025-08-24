// Test environment setup
import { afterAll, beforeAll } from 'bun:test'
import { startTestDatabase, stopTestDatabase } from './helpers/testDatabase'
import { startTestServer, stopTestServer } from './helpers/testServer'

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

afterAll(() => {
  console.log('🧪 Test environment stopped')
  stopTestDatabase()
  stopTestServer()
})

export {} 

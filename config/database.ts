import knex from 'knex'

const config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'codeclimbers'
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'knex_migrations'
  }
}

// Create a function to get the database instance
// This allows us to override it during testing
const createDatabase = () => {
  // Check if we're in test mode and have a test database available
  if (process.env.NODE_ENV === 'test') {
    try {
      const testConfig = require('../tests/helpers/testDatabaseConfig')
      const testDb = testConfig.getTestDatabase()
      if (testDb) {
        return testDb
      }
    } catch (error) {
      // Test config not available, use normal database
    }
  }
  
  return knex(config)
}

export const db = createDatabase()

export default db 

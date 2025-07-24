import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import knex, { Knex } from 'knex'

let container: StartedPostgreSqlContainer | null = null
let testDb: Knex | null = null

export const startTestDatabase = async (): Promise<Knex> => {
  if (testDb) {
    return testDb
  }

  console.log('Starting PostgreSQL test container...')
  
  container = await new PostgreSqlContainer('postgres:15')
    .withDatabase('testdb')
    .withUsername('testuser')
    .withPassword('testpass')
    .withExposedPorts(5432)
    .start()

  const connectionConfig = {
    host: container.getHost(),
    port: container.getMappedPort(5432),
    user: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
  }

  testDb = knex({
    client: 'pg',
    connection: connectionConfig,
    pool: {
      min: 1,
      max: 5
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  })

  // Set environment variables for the application to use
  process.env.DB_HOST = connectionConfig.host
  process.env.DB_PORT = connectionConfig.port.toString()
  process.env.DB_USER = connectionConfig.user
  process.env.DB_PASSWORD = connectionConfig.password
  process.env.DB_NAME = connectionConfig.database

  console.log(`Test database started on ${connectionConfig.host}:${connectionConfig.port}`)
  
  return testDb
}

export const stopTestDatabase = async (): Promise<void> => {
  if (testDb) {
    await testDb.destroy()
    testDb = null
  }

  if (container) {
    await container.stop()
    container = null
    console.log('Test database stopped')
  }

  // Clean up environment variables
  delete process.env.DB_HOST
  delete process.env.DB_PORT
  delete process.env.DB_USER
  delete process.env.DB_PASSWORD
  delete process.env.DB_NAME
}

export const getTestDatabase = (): Knex => {
  if (!testDb) {
    throw new Error('Test database not started. Call startTestDatabase() first.')
  }
  return testDb
}

export const resetTestDatabase = async (): Promise<void> => {
  const db = getTestDatabase()
  
  // Get all table names
  const tables = await db.raw(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  `)
  
  // Drop all tables (except migrations table)
  for (const table of tables.rows) {
    if (table.tablename !== 'knex_migrations') {
      await db.raw(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE`)
    }
  }
}
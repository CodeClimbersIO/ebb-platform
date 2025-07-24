import { newDb, IMemoryDb } from 'pg-mem'
import knex, { Knex } from 'knex'

let memoryDb: IMemoryDb | null = null
let testDb: Knex | null = null

export const startTestDatabase = async (): Promise<Knex> => {
  if (testDb) {
    return testDb
  }

  console.log('Starting in-memory PostgreSQL...')
  
  // Create a new in-memory database
  memoryDb = newDb()
  
  // Enable PostGIS if needed (optional)
  // memoryDb.public.registerFunction()
  
  // Get knex adapter from pg-mem
  testDb = memoryDb.adapters.createKnex() as Knex

  // Set environment variables to indicate we're using in-memory DB
  process.env.DB_HOST = 'localhost'
  process.env.DB_PORT = '5433'
  process.env.DB_USER = 'testuser'
  process.env.DB_PASSWORD = 'testpass'
  process.env.DB_NAME = 'testdb'

  console.log('process.env.DB_HOST', process.env)
  console.log('In-memory PostgreSQL database ready')
  
  return testDb
}

export const stopTestDatabase = async (): Promise<void> => {
  if (testDb) {
    await testDb.destroy()
    testDb = null
  }

  if (memoryDb) {
    // In-memory database is automatically cleaned up
    memoryDb = null
    console.log('In-memory PostgreSQL stopped')
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
import { newDb, type IMemoryDb } from 'pg-mem'
import knex, { Knex } from 'knex'
import { setTestDatabase, clearTestDatabase } from './testDatabaseConfig'
import { readFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

let memoryDb: IMemoryDb | null = null
let testDb: Knex | null = null
const generatedUuids = new Set<string>()

export const startTestDatabase = async (): Promise<Knex> => {
  if (testDb) {
    return testDb
  }

  console.log('Starting in-memory PostgreSQL...')
  
  // Set test environment
  process.env.NODE_ENV = 'test'
  
  // Create a new in-memory database
  memoryDb = newDb()
  
  // Enable necessary PostgreSQL functions for our application
  memoryDb.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid' as any,
    implementation: () => {
      // Generate unique UUIDs and track them to avoid duplicates
      let uuid: string
      do {
        uuid = randomUUID()
      } while (generatedUuids.has(uuid))
      
      generatedUuids.add(uuid)
      return uuid
    }
  })
  
  // Register auth.uid() function (returns null for test environment)
  memoryDb.public.registerFunction({
    name: 'uid',
    returns: 'uuid' as any,
    implementation: () => null
  })
  
  // Get knex adapter from pg-mem
  testDb = memoryDb.adapters.createKnex() as Knex

  // Run Supabase migrations to create required tables
  await runSupabaseMigrations(testDb)
  
  // Register the test database
  setTestDatabase(testDb)
  
  console.log('In-memory PostgreSQL database ready with test schema')
  
  return testDb
}

export const stopTestDatabase = async (): Promise<void> => {
  // Clear the test database registration
  clearTestDatabase()
  
  // Reset test environment
  delete process.env.NODE_ENV
  
  // Clear UUID tracking for next test run
  generatedUuids.clear()
  
  if (testDb) {
    await testDb.destroy()
    testDb = null
  }

  if (memoryDb) {
    // In-memory database is automatically cleaned up
    memoryDb = null
    console.log('In-memory PostgreSQL stopped')
  }
}

export const getTestDatabase = (): Knex => {
  if (!testDb) {
    throw new Error('Test database not started. Call startTestDatabase() first.')
  }
  return testDb
}

export const resetTestDatabase = async (): Promise<void> => {
  const db = getTestDatabase()
  
  // Clear all test data from our tables
  await db('activity_day_rollup').del()
  await db('user_profile').del()
  await db('auth.users').del()
}

// Run the actual Supabase migrations 
const runSupabaseMigrations = async (db: Knex): Promise<void> => {
  // Only create the auth schema and users table (Supabase defaults)
  await db.raw('CREATE SCHEMA IF NOT EXISTS auth')
  
  // Register auth.uid() function on the auth schema
  try {
    const authSchema = memoryDb!.getSchema('auth')
    authSchema.registerFunction({
      name: 'uid',
      returns: 'uuid' as any, 
      implementation: () => null
    })
  } catch (error) {
    console.warn('Could not register auth schema functions:', error)
  }
  
  // Create minimal auth.users table for FK references
  await db.raw(`
    CREATE TABLE auth.users (
      id UUID PRIMARY KEY
    )
  `)
  
  // Now run the actual migration files
  const migrationsDir = join(__dirname, '../../supabase/migrations')
  const migrationFiles = [
    '20240404_create_license_tables.sql', // Contains handle_updated_at function  
    '20250523010151_add_profile.sql',     // Creates user_profile table
    '20250613013303_add_daily_rollup.sql' // Creates activity_day_rollup table
  ]
  
  for (const filename of migrationFiles) {
    const migrationPath = join(migrationsDir, filename)
    let migrationSql = readFileSync(migrationPath, 'utf8')
    
    // Clean up migration SQL for pg-mem compatibility
    migrationSql = migrationSql
      .replace(/CREATE OR REPLACE FUNCTION.*?END;[\s]*\$\$[\s]*LANGUAGE[\s]+plpgsql;/gs, '') // Remove function definitions
      .replace(/DEFAULT gen_random_uuid\(\)/g, '') // Remove DEFAULT UUID generation (pg-mem issue)
      .replace(/ALTER TABLE .* ENABLE ROW LEVEL SECURITY;/g, '') // Remove RLS
      .replace(/CREATE POLICY.*?;/gs, '') // Remove policies
      .replace(/GRANT.*?;/g, '') // Remove grants
      .replace(/CREATE TRIGGER.*?;/gs, '') // Remove triggers
      .replace(/-- ROLLBACK.*$/gms, '') // Remove rollback comments
    
    // Execute each statement
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    for (const statement of statements) {
      try {
        await db.raw(statement)
      } catch (error) {
        console.warn('error', error)
      }
    }
  }
  
  // Insert test data after migrations
  await insertTestData(db)
}

// Insert test data for the marketing endpoints
const insertTestData = async (db: Knex): Promise<void> => {
  // Generate proper random UUIDs for test users
  const userId1 = randomUUID()
  const userId2 = randomUUID()
  
  await db('auth.users').insert([
    { id: userId1 },
    { id: userId2 }
  ])
  
  await db('user_profile').insert([
    { id: userId1, last_check_in: new Date().toISOString() },
    { id: userId2, last_check_in: new Date().toISOString() }
  ])
  
  // Insert test activity data for the last few days
  const today = new Date()
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    // Insert each record with explicit UUIDs since we removed DEFAULT
    await db('activity_day_rollup').insert({
      id: randomUUID(),
      user_id: userId1,
      date: dateStr,
      tag_name: 'coding',
      total_duration_minutes: 120 + (i * 30)
    })
    
    await db('activity_day_rollup').insert({
      id: randomUUID(),
      user_id: userId2, 
      date: dateStr,
      tag_name: 'design',
      total_duration_minutes: 90 + (i * 20)
    })
  }
}


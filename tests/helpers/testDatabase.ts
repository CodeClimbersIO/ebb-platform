import knex, { Knex } from 'knex'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { createDatabase } from '../../config/database'

let testDb: Knex | null = null

export const setTestDatabase = (db: Knex): void => {
  testDb = db
}

export const clearTestDatabase = (): void => {
  testDb = null
}

export const startTestDatabase = async (): Promise<Knex> => {
  if (testDb) {
    return testDb
  }

  console.log('Connecting to test PostgreSQL database...')
  // Set test environment
  process.env.NODE_ENV = 'test'
  
  // Determine connection config based on environment
  const isCI = process.env.CI === 'true'
  const connectionConfig = {
    host: 'localhost',
    port: isCI ? 5432 : 5433, // CI uses standard port, local uses 5433
    user: 'test_user',
    password: 'test_pass',
    database: 'ebb_test'
  }
  
  // Create knex connection to PostgreSQL
  testDb = knex({
    client: 'postgresql',
    connection: connectionConfig,
    pool: {
      min: 1,
      max: 5
    }
  })

  // Test connection
  try {
    await testDb.raw('SELECT 1')
  } catch (error) {
    throw new Error(`Failed to connect to test database: ${error}`)
  }

  // Run database setup
  await setupTestDatabase(testDb)
  
  // Force the proxy to use this test database
  createDatabase()
  
  console.log('Test PostgreSQL database ready with test schema')
  
  return testDb
}

export const stopTestDatabase = async (): Promise<void> => {
  
  console.log('Deleting test environment')
  console.log(testDb)
  if (testDb) {
    try {
      await resetTestDatabase()
      await testDb.destroy()
      testDb = null
    } catch (error) {
      console.error('Failed to destroy test database:', error)
    }
  }
  clearTestDatabase()

  console.log('Test PostgreSQL connection closed')
}

export const getTestDatabase = (): Knex => {
  console.log('getTestDatabase', testDb)
  if (!testDb) {
    console.log('testDb not found')
    throw new Error('Test database not started. Call startTestDatabase() first.')
  }
  return testDb
}

export const resetTestDatabase = async (): Promise<void> => {
  const db = getTestDatabase()
  
  console.log('Dropping all test database tables...')
  
  try {
    // Drop all tables in both schemas completely
    await db.raw(`
      DROP SCHEMA IF EXISTS public CASCADE;
      DROP SCHEMA IF EXISTS auth CASCADE;
      DROP SCHEMA IF EXISTS cron CASCADE;
      DROP ROLE IF EXISTS authenticated;
      DROP ROLE IF EXISTS service_role;

    `)
    
    // Recreate empty schemas
    await db.raw(`
      CREATE SCHEMA public;
      CREATE SCHEMA auth;
    `)
    
  } catch (error) {
    console.error('Failed to drop database tables:', error instanceof Error ? error.message : error)
    throw new Error(`Database reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  console.log('Test database tables dropped completely')
}

// Set up the test database with migrations and test data
const setupTestDatabase = async (db: Knex): Promise<void> => {
  // Create auth schema and minimal auth.users table
  await db.raw('CREATE SCHEMA IF NOT EXISTS auth')
  
  // Create the authenticated role that Supabase uses (if it doesn't exist)
  try {
    await db.raw('CREATE ROLE authenticated')
    await db.raw('CREATE ROLE service_role')
  } catch (error) {
    // Ignore error if role already exists
    if (!(error instanceof Error && error.message.includes('already exists'))) {
      throw error
    }
  }
  
  // Create mock cron schema and functions for pg_cron extension
  await db.raw('CREATE SCHEMA IF NOT EXISTS cron')
  await db.raw(`
    CREATE OR REPLACE FUNCTION cron.schedule(job_name text, cron_schedule text, sql_command text)
    RETURNS bigint AS $$
    BEGIN
      -- Mock function for testing - just return a fake job id
      RETURN 1;
    END;
    $$ LANGUAGE plpgsql;
  `)
  
  await db.raw(`
    CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
    RETURNS boolean AS $$
    BEGIN
      -- Mock function for testing - always return true
      RETURN true;
    END;
    $$ LANGUAGE plpgsql;
  `)
  
  // Create minimal auth.users table for FK references
  await db.raw(`
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `)
  
  // Mock auth.uid() function to return null (or a test user ID)
  await db.raw(`
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS UUID AS $$
    BEGIN
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `)
  
  // Mock auth.email() function to return null (or a test email)
  await db.raw(`
    CREATE OR REPLACE FUNCTION auth.email()
    RETURNS TEXT AS $$
    BEGIN
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `)
  
  // Run the actual migration files
  await runMigrations(db)
  
  // Insert test data after migrations
  await insertTestData(db)
}

// Run the Supabase migrations
const runMigrations = async (db: Knex): Promise<void> => {
  const migrationsDir = join(__dirname, '../../supabase/migrations')
  
  // Read all SQL files and sort them chronologically by filename
  const allFiles = readdirSync(migrationsDir)
  const migrationFiles = allFiles
    .filter(file => file.endsWith('.sql'))
    .sort() // SQL migration files are named with timestamps, so sorting works
  
  console.log(`Running ${migrationFiles.length} migration files...`)
  
  for (const filename of migrationFiles) {
    console.log(`Running migration: ${filename}`)
    const migrationPath = join(migrationsDir, filename)
    const migrationSql = readFileSync(migrationPath, 'utf8')

    
    try {
      await db.raw(migrationSql)
    } catch (error) {
      if (error instanceof Error && !error.message.includes('already exists')) {
        console.warn(`Migration warning in ${filename} for statement: ${migrationSql.substring(0, 50)}...`, error.message)
      }
      throw error
    }
  }
  
  console.log('All migrations completed')
}

// Insert test data for the marketing endpoints
const insertTestData = async (db: Knex): Promise<void> => {
  // Generate proper random UUIDs for test users
  const userId1 = randomUUID()
  const userId2 = randomUUID()
  const founderId = '409cf9b9-7aae-4a13-aca9-1bcd7b9a4209' // Hardcoded founder ID from migration
  
  await db('auth.users').insert([
    { id: founderId, email: 'founder@example.com' },
    { id: userId1, email: 'test1@example.com' },
    { id: userId2, email: 'test2@example.com' }
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
    
    await db('activity_day_rollup').insert({
      user_id: userId1,
      date: dateStr,
      tag_name: 'coding',
      total_duration_minutes: 120 + (i * 30)
    })
    
    await db('activity_day_rollup').insert({
      user_id: userId2, 
      date: dateStr,
      tag_name: 'design',
      total_duration_minutes: 90 + (i * 20)
    })
  }
}
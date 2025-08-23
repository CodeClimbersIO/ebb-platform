import knex, { Knex } from 'knex'
import { setTestDatabase, clearTestDatabase } from './testDatabaseConfig'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

let testDb: Knex | null = null

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
  
  // Register the test database
  setTestDatabase(testDb)
  
  console.log('Test PostgreSQL database ready with test schema')
  
  return testDb
}

export const stopTestDatabase = async (): Promise<void> => {
  // Clear the test database registration
  clearTestDatabase()
  
  // Reset test environment
  delete process.env.NODE_ENV
  
  if (testDb) {
    await testDb.destroy()
    testDb = null
  }

  console.log('Test PostgreSQL connection closed')
}

export const getTestDatabase = (): Knex => {
  if (!testDb) {
    throw new Error('Test database not started. Call startTestDatabase() first.')
  }
  return testDb
}

export const resetTestDatabase = async (): Promise<void> => {
  const db = getTestDatabase()
  
  console.log('Resetting test database...')
  
  try {
    // Get all user-created tables (exclude system tables)
    const result = await db.raw(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname IN ('public', 'auth') 
      AND tablename NOT LIKE 'pg_%' 
      AND tablename NOT LIKE 'sql_%'
      ORDER BY tablename
    `)
    
    const tables = result.rows.map((row: any) => row.tablename)
    console.log(`Clearing ${tables.length} tables: ${tables.join(', ')}`)
    
    if (tables.length === 0) {
      console.log('No tables found to reset')
      return
    }
    
    // Build schema-qualified table names
    const schemaQualifiedTables = tables.map((table: string) => 
      table === 'users' ? 'auth.users' : `public.${table}`
    )
    
    // Use TRUNCATE with CASCADE to handle foreign key constraints
    // This is more explicit and robust than disabling constraints
    const truncateStatement = `TRUNCATE TABLE ${schemaQualifiedTables.join(', ')} RESTART IDENTITY CASCADE`
    
    console.log('Truncating all tables with CASCADE to handle foreign keys...')
    await db.raw(truncateStatement)
    
  } catch (error) {
    console.error('Failed to reset database:', error instanceof Error ? error.message : error)
    throw new Error(`Database reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  console.log('Test database reset complete')
}

// Set up the test database with migrations and test data
const setupTestDatabase = async (db: Knex): Promise<void> => {
  // Create auth schema and minimal auth.users table
  await db.raw('CREATE SCHEMA IF NOT EXISTS auth')
  
  // Create minimal auth.users table for FK references
  await db.raw(`
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY
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
    
    // Execute each statement
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    for (const statement of statements) {
      try {
        await db.raw(statement)
      } catch (error) {
        // Log but don't fail on expected errors (like duplicate functions/tables)
        if (error instanceof Error && !error.message.includes('already exists')) {
          console.warn(`Migration warning in ${filename} for statement: ${statement.substring(0, 50)}...`, error.message)
        }
      }
    }
  }
  
  console.log('All migrations completed')
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
import knex, { Knex } from 'knex'

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
const isCI = process.env.CI === 'true'

const testConfig = {
  client: 'pg',
  connection: {
    host: 'localhost',
    port: isCI ? 5432 : 5433,
    user: 'test_user',
    password: 'test_pass',
    database: 'ebb_test'
  },
  pool: {
    min: 1,
    max: 5
  },
}

let db: Knex | null = null

export const createDatabase = (): Knex => {
  if (process.env.NODE_ENV === 'test') {
    return knex(testConfig)
  } else {
    return knex(config)
  }
}

export const getDb = (): Knex => {
  if(!db) {
    db = createDatabase()
  }
  return db
}
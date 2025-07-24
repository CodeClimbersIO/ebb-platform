import { Knex } from 'knex'

let testDatabaseInstance: Knex | null = null

export const setTestDatabase = (db: Knex): void => {
  testDatabaseInstance = db
}

export const getTestDatabase = (): Knex | null => {
  return testDatabaseInstance
}

export const clearTestDatabase = (): void => {
  testDatabaseInstance = null
}
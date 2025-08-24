import { Server } from 'http'
import app from '../../index'
import { stopTestDatabase } from './testDatabase'

let server: Server | null = null
const TEST_PORT = 3002 // Use different port for testing

export const startTestServer = async (): Promise<void> => {
  if (server) {
    return
  }

  return new Promise((resolve, reject) => {
    server = app.listen(TEST_PORT, (err?: Error) => {
      if (err) {
        reject(err)
      } else {
        console.log(`Test server started on port ${TEST_PORT}`)
        resolve()
      }
    })
  })
}

export const stopTestServer = async (): Promise<void> => {
  return new Promise((resolve) => {
    if (server) {
      server.close(async () => {
        server = null
        console.log('Test server stopped')
        resolve()
      })
    } else {
      // Even if no server, still clean up database
      stopTestDatabase().then(() => resolve())
    }
  })
}

export const getTestServerUrl = () => `http://localhost:${TEST_PORT}`
export const getTestPort = () => TEST_PORT 

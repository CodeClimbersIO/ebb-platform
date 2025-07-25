import { Worker } from 'bullmq'
import { redisConfig } from '../config/redis.js'
import { jobProcessors } from './JobProcessors.js'
import { JOB_QUEUES } from '../types/jobs.js'

let worker: Worker | null = null
let isInitialized = false

const setupEventListeners = (workerInstance: Worker) => {
  workerInstance.on('completed', (job: any, result: any) => {
    console.log(`✅ Slack cleanup job ${job.id} (${job.name}) completed successfully`)
    if (result?.message) {
      console.log(`   📊 Result: ${result.message}`)
    }
  })

  workerInstance.on('failed', (job: any, err: Error) => {
    console.error(`❌ Slack cleanup job ${job?.id} (${job?.name}) failed:`, err.message)
  })

  workerInstance.on('stalled', (jobId: string) => {
    console.warn(`⚠️  Slack cleanup job ${jobId} stalled`)
  })

  workerInstance.on('error', (err: Error) => {
    console.error('❌ Slack cleanup worker error:', err)
  })
}

const initialize = async () => {
  if (isInitialized) {
    return
  }

  try {
    console.log('🚀 Initializing Slack Cleanup Queue Service...')

    // Initialize worker for Slack cleanup queue
    worker = new Worker(
      JOB_QUEUES.SLACK_CLEANUP,
      async (job: any) => {
        const processor = jobProcessors[job.name as keyof typeof jobProcessors]
        if (!processor) {
          throw new Error(`No processor found for job type: ${job.name}`)
        }
        return processor(job)
      },
      {
        connection: redisConfig,
        concurrency: 3, // Process up to 3 Slack cleanup jobs concurrently
      }
    )

    setupEventListeners(worker)

    await worker.waitUntilReady()

    console.log('✅ Slack Cleanup Queue Service initialized successfully')
    isInitialized = true
  } catch (error) {
    console.error('❌ Failed to initialize Slack Cleanup Queue Service:', error)
    throw error
  }
}

const shutdown = async () => {
  console.log('🛑 Shutting down Slack Cleanup Queue Service...')
  
  if (worker) {
    await worker.close()
    worker = null
  }
  
  isInitialized = false
  console.log('✅ Slack Cleanup Queue Service shut down successfully')
}

export const slackCleanupQueueService = {
  initialize,
  shutdown
}
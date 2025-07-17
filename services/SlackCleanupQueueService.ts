import { Worker } from 'bullmq'
import { redisConfig } from '../config/redis.js'
import { jobProcessors } from './JobProcessors.js'
import { JOB_QUEUES } from '../types/jobs.js'

class SlackCleanupQueueServiceClass {
  private worker: Worker
  private isInitialized = false

  constructor() {
    // Initialize worker for Slack cleanup queue
    this.worker = new Worker(
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

    this.setupEventListeners()
  }

  private setupEventListeners() {
    this.worker.on('completed', (job: any, result: any) => {
      console.log(`✅ Slack cleanup job ${job.id} (${job.name}) completed successfully`)
      if (result?.message) {
        console.log(`   📊 Result: ${result.message}`)
      }
    })

    this.worker.on('failed', (job: any, err: Error) => {
      console.error(`❌ Slack cleanup job ${job?.id} (${job?.name}) failed:`, err.message)
    })

    this.worker.on('stalled', (jobId: string) => {
      console.warn(`⚠️  Slack cleanup job ${jobId} stalled`)
    })

    this.worker.on('error', (err: Error) => {
      console.error('❌ Slack cleanup worker error:', err)
    })
  }

  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('🚀 Initializing Slack Cleanup Queue Service...')

      await this.worker.waitUntilReady()

      console.log('✅ Slack Cleanup Queue Service initialized successfully')
      this.isInitialized = true
    } catch (error) {
      console.error('❌ Failed to initialize Slack Cleanup Queue Service:', error)
      throw error
    }
  }

  async shutdown() {
    console.log('🛑 Shutting down Slack Cleanup Queue Service...')
    
    await this.worker.close()
    
    console.log('✅ Slack Cleanup Queue Service shut down successfully')
  }
}

export const slackCleanupQueueService = new SlackCleanupQueueServiceClass()
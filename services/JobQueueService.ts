import { Queue, Worker } from 'bullmq'
import { redisConfig } from '../config/redis'
import { jobProcessors } from './JobProcessors'
import { JOB_QUEUES, JOB_TYPES, JOB_PRIORITIES } from '../types/jobs'

class JobQueueService {
  private queue: Queue | null = null
  private worker: Worker | null = null
  private isInitialized = false

  constructor() {
    // Don't initialize queue and worker in constructor
    // They will be created lazily during initialize()
  }

  private setupEventListeners() {
    if (!this.queue || !this.worker) {
      throw new Error('Queue and worker must be initialized before setting up event listeners')
    }

    // Queue events
    this.queue.on('waiting', (job: any) => {
      console.log(`📋 Job ${job.id} (${job.name}) is waiting`)
    })

    // Worker events
    this.worker.on('completed', (job: any, result: any) => {
      console.log(`✅ Job ${job.id} (${job.name}) completed successfully`)
      if (result?.data?.count > 0) {
        console.log(`   📊 Result: ${result.message}`)
      }
    })

    this.worker.on('failed', (job: any, err: Error) => {
      console.error(`❌ Job ${job?.id} (${job?.name}) failed:`, err.message)
    })

    this.worker.on('stalled', (jobId: string) => {
      console.warn(`⚠️  Job ${jobId} stalled`)
    })

    this.worker.on('error', (err: Error) => {
      console.error('❌ Worker error:', err)
    })
  }

  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('🚀 Initializing Job Queue Service...')

      // Create queue and worker
      this.queue = new Queue(JOB_QUEUES.USER_MONITORING, {
        connection: redisConfig,
        defaultJobOptions: {
          removeOnComplete: 50, // Keep last 50 completed jobs
          removeOnFail: 100,    // Keep last 100 failed jobs
          attempts: 3,          // Retry failed jobs up to 3 times
          backoff: {
            type: 'exponential',
            delay: 2000,        // Start with 2 second delay
          },
        },
      })

      this.worker = new Worker(
        JOB_QUEUES.USER_MONITORING,
        async (job: any) => {
          const processor = jobProcessors[job.name as keyof typeof jobProcessors]
          if (!processor) {
            throw new Error(`No processor found for job type: ${job.name}`)
          }
          return processor(job)
        },
        {
          connection: redisConfig,
          concurrency: 5, // Process up to 5 jobs concurrently
        }
      )

      // Set up event listeners
      this.setupEventListeners()

      // Wait for Redis connections
      await Promise.all([
        this.queue.waitUntilReady(),
        this.worker.waitUntilReady(),
      ])

      console.log('✅ Job Queue Service initialized successfully')

      // Schedule recurring jobs
      await this.scheduleRecurringJobs()

      this.isInitialized = true
    } catch (error) {
      console.error('❌ Failed to initialize Job Queue Service:', error)
      throw error
    }
  }

  private async scheduleRecurringJobs() {
    if (!this.queue) {
      throw new Error('Queue not initialized')
    }

    console.log('📅 Scheduling recurring jobs...')

    // Schedule test job every minute (for testing)
    await this.queue.add(
      JOB_TYPES.TEST_JOB,
      {},
      {
        repeat: {
          pattern: '* * * * *', // Every minute
        },
        priority: JOB_PRIORITIES.NORMAL,
        jobId: 'recurring-test-job',
      }
    )

    // Schedule new user check every 10 minutes
    await this.queue.add(
      JOB_TYPES.CHECK_NEW_USERS,
      {},
      {
        repeat: {
          pattern: '*/10 * * * *', // Every 10 minutes
        },
        priority: JOB_PRIORITIES.NORMAL,
        jobId: 'recurring-new-user-check',
      }
    )

    // Schedule paid user check every 10 minutes
    await this.queue.add(
      JOB_TYPES.CHECK_PAID_USERS,
      {},
      {
        repeat: {
          pattern: '*/10 * * * *', // Every 10 minutes
        },
        priority: JOB_PRIORITIES.NORMAL,
        jobId: 'recurring-paid-user-check',
      }
    )

    // Schedule inactive user check daily at 9 AM
    await this.queue.add(
      JOB_TYPES.CHECK_INACTIVE_USERS,
      {},
      {
        repeat: {
          pattern: '0 9 * * *', // Daily at 9:00 AM
        },
        priority: JOB_PRIORITIES.HIGH,
        jobId: 'recurring-inactive-user-check',
      }
    )

    // Schedule offline user check every 5 minutes
    await this.queue.add(
      JOB_TYPES.CHECK_OFFLINE_USERS,
      {},
      {
        repeat: {
          pattern: '*/5 * * * *', // Every 5 minutes
        },
        priority: JOB_PRIORITIES.NORMAL,
        jobId: 'recurring-offline-user-check',
      }
    )

    console.log('✅ Recurring jobs scheduled successfully')
    console.log('   🧪 Test job: Every minute')
    console.log('   📋 New user check: Every 10 minutes')
    console.log('   💳 Paid user check: Every 10 minutes')
    console.log('   😴 Inactive user check: Daily at 9:00 AM')
    console.log('   🔄 Offline user check: Every 5 minutes')
  }

  // Manual job triggers (for testing or one-off runs)
  async triggerNewUserCheck() {
    if (!this.queue) {
      throw new Error('Queue not initialized')
    }
    return this.queue.add(JOB_TYPES.CHECK_NEW_USERS, {}, {
      priority: JOB_PRIORITIES.HIGH,
    })
  }

  async triggerPaidUserCheck() {
    if (!this.queue) {
      throw new Error('Queue not initialized')
    }
    return this.queue.add(JOB_TYPES.CHECK_PAID_USERS, {}, {
      priority: JOB_PRIORITIES.HIGH,
    })
  }

  async triggerInactiveUserCheck() {
    if (!this.queue) {
      throw new Error('Queue not initialized')
    }
    return this.queue.add(JOB_TYPES.CHECK_INACTIVE_USERS, {}, {
      priority: JOB_PRIORITIES.HIGH,
    })
  }

  async triggerOfflineUserCheck() {
    if (!this.queue) {
      throw new Error('Queue not initialized')
    }
    return this.queue.add(JOB_TYPES.CHECK_OFFLINE_USERS, {}, {
      priority: JOB_PRIORITIES.HIGH,
    })
  }

  async triggerTestJob() {
    if (!this.queue) {
      throw new Error('Queue not initialized')
    }
    return this.queue.add(JOB_TYPES.TEST_JOB, {}, {
      priority: JOB_PRIORITIES.HIGH,
    })
  }

  // Get queue stats
  async getQueueStats() {
    if (!this.queue) {
      throw new Error('Queue not initialized')
    }
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    }
  }

  // Clean up resources
  async shutdown() {
    console.log('🛑 Shutting down Job Queue Service...')
    
    const promises = []
    if (this.worker) {
      promises.push(this.worker.close())
    }
    if (this.queue) {
      promises.push(this.queue.close())
    }
    
    if (promises.length > 0) {
      await Promise.all(promises)
    }
    
    this.queue = null
    this.worker = null
    this.isInitialized = false
    
    console.log('✅ Job Queue Service shut down successfully')
  }
}

// Export singleton instance
export const jobQueueService = new JobQueueService() 
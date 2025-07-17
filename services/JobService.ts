import { Queue } from 'bullmq'
import { redisConfig } from '../config/redis.js'
import { JOB_QUEUES, JOB_PRIORITIES } from '../types/jobs.js'

interface AddJobOptions {
  queue: string
  jobType: string
  data: any
  delay?: number
  priority?: number
  repeat?: any
  jobId?: string
}

class JobServiceClass {
  private queues: Map<string, Queue> = new Map()

  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: redisConfig,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      })
      this.queues.set(queueName, queue)
    }
    return this.queues.get(queueName)!
  }

  async addJob(options: AddJobOptions) {
    const { queue, jobType, data, delay, priority, repeat, jobId } = options
    
    const queueInstance = this.getQueue(queue)
    
    const jobOptions: any = {
      priority: priority || JOB_PRIORITIES.NORMAL,
    }

    if (delay) {
      jobOptions.delay = delay
    }

    if (repeat) {
      jobOptions.repeat = repeat
    }

    if (jobId) {
      jobOptions.jobId = jobId
    }

    return queueInstance.add(jobType, data, jobOptions)
  }

  async shutdown() {
    console.log('🛑 Shutting down JobService...')
    
    const promises = Array.from(this.queues.values()).map(queue => queue.close())
    await Promise.all(promises)
    
    this.queues.clear()
    console.log('✅ JobService shut down successfully')
  }
}

export const JobService = new JobServiceClass()
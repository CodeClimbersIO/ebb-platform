import { Queue } from 'bullmq'
import { redisConfig } from '../config/redis.js'
import { JOB_PRIORITIES } from '../types/jobs.js'

interface AddJobOptions {
  queue: string
  jobType: string
  data: any
  delay?: number
  priority?: number
  repeat?: any
  jobId?: string
}

const queues: Map<string, Queue> = new Map()

const getQueue = (queueName: string): Queue => {
  if (!queues.has(queueName)) {
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
    queues.set(queueName, queue)
  }
  return queues.get(queueName)!
}

const addJob = async (options: AddJobOptions) => {
  const { queue, jobType, data, delay, priority, repeat, jobId } = options
  
  const queueInstance = getQueue(queue)
  
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

const shutdown = async () => {
  console.log('🛑 Shutting down JobService...')
  
  const promises = Array.from(queues.values()).map(queue => queue.close())
  await Promise.all(promises)
  
  queues.clear()
  console.log('✅ JobService shut down successfully')
}

export const JobService = {
  addJob,
  shutdown
}
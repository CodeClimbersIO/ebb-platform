// Job types and data interfaces

export interface NewUserCheckJobData {
  // No specific data needed for this job
}

export interface PaidUserCheckJobData {
  // No specific data needed for this job  
}

export interface InactiveUserCheckJobData {
  // No specific data needed for this job
}

export interface TestJobData {
  // No specific data needed for this test job
}

export interface UserMetrics {
  newUsers: number
  paidUsers: number
  inactiveUsers: number
  totalUsers: number
}

export interface NewUserRecord {
  id: string
  email: string
  created_at: Date
}

export interface PaidUserRecord {
  id: string
  email: string
  subscription_status: string
  paid_at: Date
}

export interface InactiveUserRecord {
  id: string
  email: string
  last_activity: Date
  days_inactive: number
}

// Job result types
export interface JobResult {
  success: boolean
  message: string
  data?: any
  processedAt: Date
}

// Job queue names
export const JOB_QUEUES = {
  USER_MONITORING: 'user-monitoring',
} as const

// Job types
export const JOB_TYPES = {
  CHECK_NEW_USERS: 'check-new-users',
  CHECK_PAID_USERS: 'check-paid-users', 
  CHECK_INACTIVE_USERS: 'check-inactive-users',
  TEST_JOB: 'test-job',
} as const

// Job priorities
export const JOB_PRIORITIES = {
  HIGH: 1,
  NORMAL: 10,
  LOW: 20,
} as const 
// Job data interfaces
export interface NewUserCheckJobData {
  [key: string]: any
}

export interface PaidUserCheckJobData {
  [key: string]: any
}

export interface InactiveUserCheckJobData {
  [key: string]: any
}

export interface TestJobData {
  [key: string]: any
}

export interface OfflineUserCheckJobData {
  [key: string]: any
}

export interface SlackCleanupJobData {
  sessionId: string
  userId: string
}

export interface WeeklyEmailReminderJobData {
  [key: string]: any
}

export interface UserMetrics {
  newUsers: number
  paidUsers: number
  inactiveUsers: number
  totalUsers: number
}

// Job result interface
export interface JobResult {
  success: boolean
  message: string
  data?: any
  processedAt: Date
}

// User record interfaces
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
  license_id?: string
  stripe_payment_id?: string
  stripe_customer_id?: string
}

export interface InactiveUserRecord {
  id: string
  email: string
  last_activity: Date
  days_inactive: number
}

export interface UserMetrics {
  newUsers: number
  paidUsers: number
  inactiveUsers: number
  totalUsers: number
}

export interface UserActivitySummary {
  activeUsers: number
  totalUsers: number
  averageHoursPerUser: number
}

// Job queues
export const JOB_QUEUES = {
  USER_MONITORING: 'user-monitoring',
  SLACK_CLEANUP: 'slack-cleanup',
} as const

export type JobQueue = typeof JOB_QUEUES[keyof typeof JOB_QUEUES]

// Job types
export const JOB_TYPES = {
  CHECK_NEW_USERS: 'check-new-users',
  CHECK_PAID_USERS: 'check-paid-users',
  CHECK_INACTIVE_USERS: 'check-inactive-users',
  CHECK_OFFLINE_USERS: 'check-offline-users',
  TEST_JOB: 'test-job',
  SLACK_CLEANUP_DND: 'slack-cleanup-dnd',
  SLACK_CLEANUP_STATUS: 'slack-cleanup-status',
  WEEKLY_EMAIL_REMINDER: 'weekly-email-reminder',
} as const

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES]

// Job priorities
export const JOB_PRIORITIES = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 15
} as const

export type JobPriority = typeof JOB_PRIORITIES[keyof typeof JOB_PRIORITIES]

// Notification types
export interface NotificationResult {
  success: boolean
  message: string
  userId: string
  notificationId?: string
  error?: string
} 
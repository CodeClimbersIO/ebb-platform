import type { NotificationConfig } from '../types/notifications'

export const notificationConfig: NotificationConfig = {
  channels: {
    discord: {
      enabled: !!(process.env.DISCORD_WEBHOOK_URL),
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
      defaultChannel: process.env.DISCORD_DEFAULT_CHANNEL
    },
    email: {
      enabled: !!(process.env.LOOPS_API_KEY),
      provider: 'loops',
      apiKey: process.env.LOOPS_API_KEY,
      templates: {
        friend_request_existing_user: process.env.LOOPS_TEMPLATE_FRIEND_REQUEST_EXISTING || 'cmc3u8e020700z00iason0m0f',
        friend_request_new_user: process.env.LOOPS_TEMPLATE_FRIEND_REQUEST_NEW || 'cmc6k356p2tf0zq0jg9y0atvr',
        weekly_report: process.env.LOOPS_TEMPLATE_WEEKLY_REPORT || ''
      }
    },
    slack: {
      enabled: !!(process.env.SLACK_WEBHOOK_URL),
      webhookUrl: process.env.SLACK_WEBHOOK_URL
    },
    sms: {
      enabled: !!(process.env.SMS_ENABLED === 'true'),
      provider: (process.env.SMS_PROVIDER as 'twilio') || 'twilio'
    }
  },
  events: {
    paid_user: ['discord'],
    new_user: ['discord'],
    inactive_user: ['discord'],
    weekly_report: ['discord'],
    payment_failed: ['discord'],
    checkout_completed: ['discord'],
    subscription_cancelled: ['discord'],
    subscription_expired: ['discord'],
    friend_request: ['email']
  }
}

export const getNotificationConfig = (): NotificationConfig => {
  return { ...notificationConfig }
}

export const updateNotificationConfig = (updates: Partial<NotificationConfig>): NotificationConfig => {
  Object.assign(notificationConfig, updates)
  return { ...notificationConfig }
}
import type { NotificationConfig } from '../types/notifications'

export const notificationConfig: NotificationConfig = {
  channels: {
    discord: {
      enabled: !!(process.env.DISCORD_WEBHOOK_URL),
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
      defaultChannel: process.env.DISCORD_DEFAULT_CHANNEL
    },
    email: {
      enabled: !!(process.env.EMAIL_ENABLED === 'true'),
      provider: (process.env.EMAIL_PROVIDER as 'sendgrid' | 'ses') || 'sendgrid'
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
    weekly_report: ['discord']
  }
}

export const getNotificationConfig = (): NotificationConfig => {
  return { ...notificationConfig }
}

export const updateNotificationConfig = (updates: Partial<NotificationConfig>): NotificationConfig => {
  Object.assign(notificationConfig, updates)
  return { ...notificationConfig }
}
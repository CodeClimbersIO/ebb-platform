import type { PaidUserRecord, NewUserRecord, InactiveUserRecord } from './jobs'

export type { PaidUserRecord, NewUserRecord, InactiveUserRecord } from './jobs'

export type NotificationType = 'paid_user' | 'new_user' | 'inactive_user' | 'weekly_report' | 'payment_failed'
export type NotificationChannel = 'discord' | 'email' | 'slack' | 'sms'

export interface BaseUserRecord {
  id: string
  email: string
}

export type UserRecord = PaidUserRecord | NewUserRecord | InactiveUserRecord | BaseUserRecord

export interface NotificationPayload {
  type: NotificationType
  user: UserRecord
  data?: any
  referenceId: string
}

export interface NotificationResult {
  success: boolean
  message: string
  userId: string
  referenceId: string
  channel: string
  notificationId?: string
  error?: string
  timestamp: Date
}

export interface NotificationProvider {
  readonly name: NotificationChannel
  send(payload: NotificationPayload): Promise<NotificationResult>
}

export interface ChannelNotificationRecord {
  id: string
  user_id: string
  notification_type: NotificationType
  channel: NotificationChannel
  reference_id: string
  sent_at: Date
  provider_result?: any
  data?: any
}

export interface NotificationConfig {
  channels: {
    discord: {
      enabled: boolean
      webhookUrl?: string
      defaultChannel?: string
    }
    email: {
      enabled: boolean
      provider?: 'sendgrid' | 'ses'
    }
    slack: {
      enabled: boolean
      webhookUrl?: string
    }
    sms: {
      enabled: boolean
      provider?: 'twilio'
    }
  }
  events: {
    [K in NotificationType]: NotificationChannel[]
  }
}

export interface DiscordWebhookPayload {
  content?: string
  embeds?: DiscordEmbed[]
  username?: string
  avatar_url?: string
}

export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: DiscordEmbedField[]
  footer?: {
    text: string
    icon_url?: string
  }
  timestamp?: string
  thumbnail?: {
    url: string
  }
}

export interface DiscordEmbedField {
  name: string
  value: string
  inline?: boolean
}
import type { 
  NotificationProvider, 
  NotificationPayload, 
  NotificationResult,
  NotificationChannel,
  NotificationType,
  PaidUserRecord,
  NewUserRecord,
  InactiveUserRecord,
  NotificationConfig
} from '../types/notifications'
import { DiscordNotificationProvider } from './providers/DiscordNotificationProvider'
import { NotificationService } from './NotificationService'

export class NotificationEngine {
  private providers: Map<NotificationChannel, NotificationProvider> = new Map()
  private config: NotificationConfig

  constructor(config: NotificationConfig) {
    this.config = config
    this.initializeProviders()
  }

  private initializeProviders() {
    // Initialize Discord provider if enabled
    if (this.config.channels.discord.enabled && this.config.channels.discord.webhookUrl) {
      const discordProvider = new DiscordNotificationProvider(this.config.channels.discord.webhookUrl)
      this.providers.set('discord', discordProvider)
      console.log('✅ Discord notification provider initialized')
    }

    // TODO: Initialize other providers (email, slack, sms) when implemented
    console.log(`📡 Notification engine initialized with ${this.providers.size} providers`)
  }

  async sendNotification(
    payload: NotificationPayload, 
    channels: NotificationChannel[]
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = []
    
    for (const channel of channels) {
      const provider = this.providers.get(channel)
      
      if (!provider) {
        console.warn(`⚠️  No provider found for channel: ${channel}`)
        results.push({
          success: false,
          message: `No provider configured for channel: ${channel}`,
          userId: payload.user.id,
          referenceId: payload.referenceId,
          channel,
          error: `Provider not configured`,
          timestamp: new Date()
        })
        continue
      }

      try {
        const result = await provider.send(payload)
        results.push(result)
        
        if (result.success) {
          console.log(`✅ ${channel} notification sent for ${payload.type}: ${payload.user.email}`)
        } else {
          console.error(`❌ ${channel} notification failed for ${payload.type}: ${result.error}`)
        }
      } catch (error) {
        console.error(`❌ Error sending ${channel} notification:`, error)
        results.push({
          success: false,
          message: `Failed to send ${channel} notification`,
          userId: payload.user.id,
          referenceId: payload.referenceId,
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        })
      }
    }

    return results
  }

  async sendPaidUserNotifications(
    user: PaidUserRecord,
    channels?: NotificationChannel[]
  ): Promise<NotificationResult[]> {
    const targetChannels = channels || this.config.events.paid_user || ['discord']
    
    const referenceId = NotificationService.generateReferenceId('paid_user', user.id, {
      paid_at: user.paid_at,
      license_id: user.license_id
    })

    const payload: NotificationPayload = {
      type: 'paid_user',
      user,
      referenceId,
      data: {
        license_id: user.license_id,
        stripe_payment_id: user.stripe_payment_id,
        stripe_customer_id: user.stripe_customer_id
      }
    }

    console.log(`📨 Sending paid user notifications to [${targetChannels.join(', ')}] for: ${user.email}`)
    return this.sendNotification(payload, targetChannels)
  }

  async sendNewUserNotifications(
    user: NewUserRecord,
    channels?: NotificationChannel[]
  ): Promise<NotificationResult[]> {
    const targetChannels = channels || this.config.events.new_user || ['discord']
    
    const referenceId = NotificationService.generateReferenceId('new_user', user.id, {
      created_at: user.created_at
    })

    const payload: NotificationPayload = {
      type: 'new_user',
      user,
      referenceId,
      data: {
        created_at: user.created_at
      }
    }

    console.log(`📨 Sending new user notifications to [${targetChannels.join(', ')}] for: ${user.email}`)
    return this.sendNotification(payload, targetChannels)
  }

  async sendInactiveUserNotifications(
    user: InactiveUserRecord,
    channels?: NotificationChannel[]
  ): Promise<NotificationResult[]> {
    const targetChannels = channels || this.config.events.inactive_user || ['discord']
    
    const referenceId = NotificationService.generateReferenceId('inactive_user', user.id, {
      last_activity: user.last_activity,
      days_inactive: user.days_inactive
    })

    const payload: NotificationPayload = {
      type: 'inactive_user',
      user,
      referenceId,
      data: {
        last_activity: user.last_activity,
        days_inactive: user.days_inactive
      }
    }

    console.log(`📨 Sending inactive user notifications to [${targetChannels.join(', ')}] for: ${user.email}`)
    return this.sendNotification(payload, targetChannels)
  }

  async sendBatchNotifications<T extends PaidUserRecord | NewUserRecord | InactiveUserRecord>(
    users: T[],
    notificationType: NotificationType,
    channels?: NotificationChannel[]
  ): Promise<NotificationResult[]> {
    console.log(`📨 Sending batch ${notificationType} notifications to ${users.length} users...`)
    
    const allResults: NotificationResult[] = []
    
    for (const user of users) {
      let results: NotificationResult[] = []
      
      switch (notificationType) {
        case 'paid_user':
          results = await this.sendPaidUserNotifications(user as PaidUserRecord, channels)
          break
        case 'new_user':
          results = await this.sendNewUserNotifications(user as NewUserRecord, channels)
          break
        case 'inactive_user':
          results = await this.sendInactiveUserNotifications(user as InactiveUserRecord, channels)
          break
        default:
          console.warn(`⚠️  Unknown notification type: ${notificationType}`)
          continue
      }
      
      allResults.push(...results)
      
      // Add small delay to avoid overwhelming notification services
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    const successCount = allResults.filter(r => r.success).length
    const failCount = allResults.filter(r => !r.success).length
    
    console.log(`📊 Batch notification results: ${successCount} sent, ${failCount} failed`)
    
    return allResults
  }

  getAvailableChannels(): NotificationChannel[] {
    return Array.from(this.providers.keys())
  }

  isChannelEnabled(channel: NotificationChannel): boolean {
    return this.providers.has(channel)
  }

  getConfig(): NotificationConfig {
    return { ...this.config }
  }

  updateConfig(newConfig: Partial<NotificationConfig>) {
    this.config = { ...this.config, ...newConfig }
    this.providers.clear()
    this.initializeProviders()
    console.log('🔄 Notification engine configuration updated')
  }
}
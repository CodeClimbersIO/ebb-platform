import type { 
  NotificationProvider, 
  NotificationPayload, 
  NotificationResult,
  DiscordWebhookPayload,
  DiscordEmbed,
  PaidUserRecord 
} from '../../types/notifications'

export class DiscordNotificationProvider implements NotificationProvider {
  readonly name = 'discord' as const
  
  constructor(private webhookUrl: string) {
    if (!webhookUrl) {
      throw new Error('Discord webhook URL is required')
    }
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const discordPayload = this.formatPayload(payload)
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(discordPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Discord API error: ${response.status} - ${errorText}`)
      }

      return {
        success: true,
        message: `Discord notification sent successfully for ${payload.type}`,
        userId: payload.user.id,
        referenceId: payload.referenceId,
        channel: this.name,
        notificationId: `discord_${Date.now()}_${payload.user.id}`,
        timestamp: new Date()
      }
    } catch (error) {
      console.error('❌ Discord notification failed:', error)
      return {
        success: false,
        message: `Failed to send Discord notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        userId: payload.user.id,
        referenceId: payload.referenceId,
        channel: this.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    }
  }

  private formatPayload(payload: NotificationPayload): DiscordWebhookPayload {
    switch (payload.type) {
      case 'paid_user':
        return this.formatPaidUserNotification(payload)
      case 'new_user':
        return this.formatNewUserNotification(payload)
      case 'inactive_user':
        return this.formatInactiveUserNotification(payload)
      case 'weekly_report':
        return this.formatWeeklyReportNotification(payload)
      case 'payment_failed':
        return this.formatPaymentFailedNotification(payload)
      default:
        return this.formatGenericNotification(payload)
    }
  }

  private formatPaidUserNotification(payload: NotificationPayload): DiscordWebhookPayload {
    const user = payload.user as PaidUserRecord
    
    const embed: DiscordEmbed = {
      title: '🎉 New Paid User!',
      description: `A new user has upgraded to a paid plan`,
      color: 0x00FF00, // Green color
      fields: [
        {
          name: '👤 User',
          value: user.email,
          inline: true
        },
        {
          name: '💰 Subscription',
          value: user.subscription_status || 'Premium',
          inline: true
        },
        {
          name: '📅 Paid At',
          value: user.paid_at ? `<t:${Math.floor(user.paid_at.getTime() / 1000)}:R>` : 'Just now',
          inline: true
        }
      ],
      footer: {
        text: 'Ebb Platform Notifications'
      },
      timestamp: new Date().toISOString()
    }

    // Add optional fields if available
    if (user.license_id) {
      embed.fields?.push({
        name: '🎫 License ID',
        value: user.license_id,
        inline: true
      })
    }

    if (user.stripe_payment_id) {
      embed.fields?.push({
        name: '💳 Payment ID',
        value: user.stripe_payment_id,
        inline: true
      })
    }

    return {
      embeds: [embed],
      username: 'Ebb Notifications',
    }
  }

  private formatNewUserNotification(payload: NotificationPayload): DiscordWebhookPayload {
    const embed: DiscordEmbed = {
      title: '👋 New User Joined!',
      description: `A new user has signed up for Ebb`,
      color: 0x0099FF, // Blue color
      fields: [
        {
          name: '👤 User',
          value: payload.user.email,
          inline: true
        },
        {
          name: '📅 Joined',
          value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true
        }
      ],
      footer: {
        text: 'Ebb Platform Notifications'
      },
      timestamp: new Date().toISOString()
    }

    return {
      embeds: [embed],
      username: 'Ebb Notifications',
    }
  }

  private formatInactiveUserNotification(payload: NotificationPayload): DiscordWebhookPayload {
    const embed: DiscordEmbed = {
      title: '😴 Inactive User Alert',
      description: `User has been inactive for an extended period`,
      color: 0xFF9900, // Orange color
      fields: [
        {
          name: '👤 User',
          value: payload.user.email,
          inline: true
        }
      ],
      footer: {
        text: 'Ebb Platform Notifications'
      },
      timestamp: new Date().toISOString()
    }

    return {
      embeds: [embed],
      username: 'Ebb Notifications',
    }
  }

  private formatWeeklyReportNotification(payload: NotificationPayload): DiscordWebhookPayload {
    const embed: DiscordEmbed = {
      title: '📊 Weekly Report',
      description: `Weekly user activity summary`,
      color: 0x9932CC, // Purple color
      fields: [
        {
          name: '📈 Report',
          value: 'Weekly metrics are ready',
          inline: false
        }
      ],
      footer: {
        text: 'Ebb Platform Notifications'
      },
      timestamp: new Date().toISOString()
    }

    return {
      embeds: [embed],
      username: 'Ebb Notifications',
    }
  }

  private formatPaymentFailedNotification(payload: NotificationPayload): DiscordWebhookPayload {
    const embed: DiscordEmbed = {
      title: '❌ Payment Failed',
      description: `Payment failed for customer`,
      color: 0xFF0000, // Red color
      fields: [
        {
          name: '📧 Customer',
          value: payload.user.email,
          inline: true
        },
        {
          name: '💰 Amount Due',
          value: payload.data?.formatted_amount || 'Unknown',
          inline: true
        },
        {
          name: '🧾 Invoice',
          value: payload.data?.invoice_id || 'Unknown',
          inline: true
        }
      ],
      footer: {
        text: 'Ebb Platform Notifications'
      },
      timestamp: new Date().toISOString()
    }

    if (payload.data?.customer_name) {
      embed.fields?.push({
        name: '👤 Customer Name',
        value: payload.data.customer_name,
        inline: true
      })
    }

    return {
      embeds: [embed],
      username: 'Ebb Notifications',
    }
  }

  private formatGenericNotification(payload: NotificationPayload): DiscordWebhookPayload {
    const embed: DiscordEmbed = {
      title: '🔔 Notification',
      description: `${payload.type} event for user ${payload.user.email}`,
      color: 0x808080, // Gray color
      footer: {
        text: 'Ebb Platform Notifications'
      },
      timestamp: new Date().toISOString()
    }

    return {
      embeds: [embed],
      username: 'Ebb Notifications',
    }
  }
}
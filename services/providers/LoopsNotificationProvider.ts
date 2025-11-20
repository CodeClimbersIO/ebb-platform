import type {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
  LoopsEmailPayload,
  LoopsTemplateConfig
} from '../../types/notifications'

export class LoopsNotificationProvider implements NotificationProvider {
  readonly name = 'email' as const

  constructor(
    private apiKey: string,
    private templates: LoopsTemplateConfig = {}
  ) {
    if (!apiKey) {
      throw new Error('Loops API key is required')
    }
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const loopsPayload = this.formatPayload(payload)

      if (!loopsPayload) {
        return {
          success: false,
          message: `No email template configured for ${payload.type}`,
          userId: payload.user.id,
          referenceId: payload.referenceId,
          channel: this.name,
          error: 'No template configured',
          timestamp: new Date()
        }
      }

      const response = await fetch('https://app.loops.so/api/v1/transactional', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loopsPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Loops API error: ${response.status} - ${errorText}`)
      }

      return {
        success: true,
        message: `Email notification sent successfully via Loops for ${payload.type}`,
        userId: payload.user.id,
        referenceId: payload.referenceId,
        channel: this.name,
        notificationId: `loops_${Date.now()}_${payload.user.id}`,
        timestamp: new Date()
      }
    } catch (error) {
      console.error('❌ Loops email notification failed:', error)
      return {
        success: false,
        message: `Failed to send email notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        userId: payload.user.id,
        referenceId: payload.referenceId,
        channel: this.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    }
  }

  private formatPayload(payload: NotificationPayload): LoopsEmailPayload | null {
    switch (payload.type) {
      case 'friend_request':
        return this.formatFriendRequestEmail(payload)
      case 'weekly_report':
        return this.formatWeeklyReportEmail(payload)
      default:
        console.warn(`⚠️  No email template for notification type: ${payload.type}`)
        return null
    }
  }

  private formatFriendRequestEmail(payload: NotificationPayload): LoopsEmailPayload {
    const isExistingUser = payload.data?.existingUser ?? false
    const templateId = isExistingUser
      ? this.templates.friend_request_existing_user || 'cmc3u8e020700z00iason0m0f'
      : this.templates.friend_request_new_user || 'cmc6k356p2tf0zq0jg9y0atvr'

    return {
      transactionalId: templateId,
      email: payload.user.email,
      dataVariables: {
        to_email: payload.user.email,
        from_email: payload.data?.fromEmail || '',
        request_id: payload.data?.requestId || payload.referenceId
      }
    }
  }

  private formatWeeklyReportEmail(payload: NotificationPayload): LoopsEmailPayload | null {
    const templateId = this.templates.weekly_report
    if (!templateId) {
      console.warn('⚠️  Weekly report email template ID not configured')
      return null
    }

    return {
      transactionalId: templateId,
      email: payload.user.email,
      dataVariables: {
        timestamp: payload.data?.timestamp || new Date().toISOString(),
        ...payload.data // Include any additional data passed in
      }
    }
  }
}

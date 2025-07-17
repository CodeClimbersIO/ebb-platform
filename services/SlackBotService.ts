import { db } from '../config/database.js'
import { SlackOAuthService } from './SlackOAuthService.js'
import { ApiError } from '../middleware/errorHandler.js'

interface SlackEvent {
  type: string
  user?: string
  text?: string
  channel?: string
  ts?: string
  event_ts?: string
  channel_type?: string
}

interface SlackEventPayload {
  token: string
  team_id: string
  api_app_id: string
  event: SlackEvent
  type: string
  event_id: string
  event_time: number
  authed_users?: string[]
}

interface SlackChatResponse {
  ok: boolean
  channel?: string
  ts?: string
  error?: string
}

interface SlackUserInfo {
  ok: boolean
  user?: {
    id: string
    name: string
    real_name?: string
  }
  error?: string
}

export class SlackBotService {
  static async handleEvent(payload: SlackEventPayload): Promise<void> {
    const { event, team_id } = payload

    // Handle direct messages and mentions
    if (event.type === 'message' && event.user && event.text && event.channel) {
      await this.handleMessage(team_id, event)
    }
  }

  private static async handleMessage(teamId: string, event: SlackEvent): Promise<void> {
    // Get workspace info
    const workspace = await db('slack_workspaces')
      .where({ team_id: teamId })
      .first()

    if (!workspace) {
      console.warn(`Received event from unknown workspace: ${teamId}`)
      return
    }

    // Find the user in our system who might be in a focus session
    const userConnection = await db('slack_user_connections as suc')
      .join('slack_preferences as sp', 'suc.user_id', 'sp.user_id')
      .where({
        'suc.workspace_id': workspace.id,
        'suc.is_active': true,
        'sp.enabled': true,
        'sp.auto_reply_enabled': true
      })
      .select('suc.*', 'sp.*')
      .first()

    if (!userConnection) {
      return // No user with auto-reply enabled
    }

    // Check if the user is currently in a focus session
    const isInFocusSession = await this.checkIfUserInFocusSession(userConnection.user_id)
    if (!isInFocusSession) {
      return // User not in focus session
    }

    // Check if message contains urgent keywords (enhanced with case-insensitive partial matching)
    const messageText = event.text?.toLowerCase() || ''
    const urgentKeywords = userConnection.urgent_keywords ? 
      JSON.parse(userConnection.urgent_keywords) : 
      ['urgent', 'emergency', 'asap', 'important']

    const isUrgent = this.checkForUrgentKeywords(messageText, urgentKeywords)

    if (isUrgent) {
      await this.sendUrgentMessageNotification(workspace, event, userConnection)
      return
    }

    // Send auto-reply
    await this.sendAutoReply(workspace, event, userConnection)
  }

  private static checkForUrgentKeywords(messageText: string, urgentKeywords: string[]): boolean {
    // Enhanced urgent keyword matching with:
    // 1. Case-insensitive matching
    // 2. Partial word matching
    // 3. Support for word boundaries to avoid false positives
    // 4. Flexible matching for common variations
    
    const normalizedMessage = messageText.toLowerCase().trim()
    
    return urgentKeywords.some((keyword: string) => {
      const normalizedKeyword = keyword.toLowerCase().trim()
      
      // If keyword is empty, skip
      if (!normalizedKeyword) return false
      
      // Exact word match (with word boundaries)
      const wordBoundaryRegex = new RegExp(`\\b${this.escapeRegex(normalizedKeyword)}\\b`, 'i')
      if (wordBoundaryRegex.test(normalizedMessage)) {
        return true
      }
      
      // Partial match for compound words or variations
      // e.g., "urgent" matches "urgently", "urgency"
      if (normalizedMessage.includes(normalizedKeyword)) {
        return true
      }
      
      // Check for common variations and abbreviations
      const variations = this.getKeywordVariations(normalizedKeyword)
      return variations.some(variation => {
        const variationRegex = new RegExp(`\\b${this.escapeRegex(variation)}\\b`, 'i')
        return variationRegex.test(normalizedMessage) || normalizedMessage.includes(variation)
      })
    })
  }

  private static getKeywordVariations(keyword: string): string[] {
    const variations: { [key: string]: string[] } = {
      'urgent': ['urgently', 'urgency', 'urgent!', 'urgent?'],
      'emergency': ['emergencies', 'emergency!', 'emergent'],
      'asap': ['a.s.a.p', 'a s a p', 'as soon as possible'],
      'important': ['importantly', 'importance', 'important!', 'important?'],
      'critical': ['critically', 'crit', 'critical!'],
      'immediate': ['immediately', 'immed', 'immediate!'],
      'priority': ['priorities', 'high priority', 'top priority', 'prio'],
      'help': ['help!', 'help?', 'need help', 'can you help'],
      'quick': ['quickly', 'quick!', 'quick?'],
      'now': ['right now', 'now!', 'now?'],
      'rush': ['rushing', 'rushed', 'rush!']
    }
    
    return variations[keyword] || []
  }

  private static escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private static async sendAutoReply(workspace: any, event: SlackEvent, userConnection: any): Promise<void> {
    const botToken = SlackOAuthService.getDecryptedToken(workspace.bot_token)
    
    const autoReplyMessage = userConnection.auto_reply_message || 
      'I\'m currently in a focus session with Ebb. If this is urgent, please mark your message as such and I\'ll get back to you as soon as possible.'

    try {
      // For DMs, respond in the same channel
      // For mentions in channels, respond in thread or DM based on channel type
      const responseChannel = event.channel_type === 'im' ? event.channel : event.user

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: responseChannel,
          text: autoReplyMessage,
          thread_ts: event.channel_type !== 'im' ? event.ts : undefined,
          as_user: false,
          username: 'Ebb Focus Assistant',
          icon_emoji: ':brain:'
        })
      })

      const data = await response.json() as SlackChatResponse
      
      if (!data.ok) {
        throw new Error(`Failed to send auto-reply: ${data.error}`)
      }

      await this.logActivity(userConnection.user_id, 'auto_reply_sent', workspace.id, {
        original_message: event.text,
        original_user: event.user,
        original_channel: event.channel,
        response_channel: responseChannel
      })
    } catch (error) {
      await this.logActivity(
        userConnection.user_id, 
        'error', 
        workspace.id, 
        { action: 'auto_reply', original_message: event.text }, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  private static async sendUrgentMessageNotification(workspace: any, event: SlackEvent, userConnection: any): Promise<void> {
    // For urgent messages, we might want to send a different type of notification
    // or break through the focus session. For now, we'll log it and potentially 
    // send a modified auto-reply acknowledging the urgency

    const botToken = SlackOAuthService.getDecryptedToken(workspace.bot_token)
    
    const urgentReplyMessage = `I see you've marked this as urgent. I'm currently in a focus session with Ebb, but I'll respond as soon as possible. If this is a true emergency, please call me directly.`

    try {
      const responseChannel = event.channel_type === 'im' ? event.channel : event.user

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: responseChannel,
          text: urgentReplyMessage,
          thread_ts: event.channel_type !== 'im' ? event.ts : undefined,
          as_user: false,
          username: 'Ebb Focus Assistant',
          icon_emoji: ':warning:'
        })
      })

      const data = await response.json() as SlackChatResponse
      
      if (data.ok) {
        await this.logActivity(userConnection.user_id, 'auto_reply_sent', workspace.id, {
          original_message: event.text,
          original_user: event.user,
          original_channel: event.channel,
          response_channel: responseChannel,
          urgent: true
        })
      }
    } catch (error) {
      await this.logActivity(
        userConnection.user_id, 
        'error', 
        workspace.id, 
        { action: 'urgent_reply', original_message: event.text }, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  private static async checkIfUserInFocusSession(userId: string): Promise<boolean> {
    // Check if user has an active focus session using our focus session tracking
    const activeFocusSession = await db('slack_focus_sessions')
      .where({ 
        user_id: userId, 
        is_active: true 
      })
      .first()

    if (!activeFocusSession) {
      return false
    }

    // Check if session has expired
    if (activeFocusSession.duration_minutes) {
      const sessionStart = new Date(activeFocusSession.start_time).getTime()
      const durationMs = activeFocusSession.duration_minutes * 60 * 1000
      const now = Date.now()
      
      if (now > sessionStart + durationMs) {
        // Session has expired, mark as inactive
        await db('slack_focus_sessions')
          .where({ id: activeFocusSession.id })
          .update({ 
            is_active: false, 
            end_time: new Date() 
          })
        return false
      }
    }

    return true
  }

  static async getUserInfo(botToken: string, userId: string): Promise<any> {
    try {
      const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
        headers: {
          'Authorization': `Bearer ${botToken}`
        }
      })

      const data = await response.json() as SlackUserInfo
      
      if (!data.ok) {
        throw new Error(`Failed to get user info: ${data.error}`)
      }

      return data.user
    } catch (error) {
      console.error('Failed to get Slack user info:', error)
      return null
    }
  }

  static async verifyEventSignature(body: string, timestamp: string, signature: string): Promise<boolean> {
    const signingSecret = process.env.SLACK_SIGNING_SECRET
    if (!signingSecret) {
      throw new ApiError('Slack signing secret not configured', 500)
    }

    const crypto = await import('crypto')
    const hmac = crypto.createHmac('sha256', signingSecret)
    const [version, hash] = signature.split('=')
    
    hmac.update(`${version}:${timestamp}:${body}`)
    const expectedSignature = hmac.digest('hex')
    
    return hash === expectedSignature
  }

  private static async logActivity(
    userId: string,
    activityType: string,
    workspaceId?: string,
    details?: any,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db('slack_session_activities').insert({
        user_id: userId,
        activity_type: activityType,
        slack_workspace_id: workspaceId,
        details: details ? JSON.stringify(details) : null,
        success,
        error_message: errorMessage
      })
    } catch (error) {
      console.error('Failed to log Slack activity:', error)
    }
  }
}
import { db } from '../config/database.js'
import { SlackOAuthService } from './SlackOAuthService.js'
import { ApiError } from '../middleware/errorHandler.js'

interface SlackUserProfile {
  ok: boolean
  profile?: {
    status_text?: string
    status_emoji?: string
    status_expiration?: number
  }
  error?: string
}

interface SlackDndInfo {
  ok: boolean
  dnd_enabled?: boolean
  next_dnd_start_ts?: number
  next_dnd_end_ts?: number
  error?: string
}

interface SlackDndResponse {
  ok: boolean
  error?: string
}

export class SlackService {
  static async setUserStatus(userId: string, statusText: string, statusEmoji: string, expiration?: number): Promise<void> {
    const connection = await this.getActiveUserConnection(userId)
    if (!connection) {
      throw new ApiError('No active Slack connection found', 404)
    }

    const token = SlackOAuthService.getDecryptedToken(connection.access_token)
    
    try {
      const response = await fetch('https://slack.com/api/users.profile.set', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: {
            status_text: statusText,
            status_emoji: statusEmoji,
            status_expiration: expiration || 0
          }
        })
      })

      const data = await response.json() as SlackUserProfile
      
      if (!data.ok) {
        throw new ApiError(`Failed to set Slack status: ${data.error}`, 400)
      }

      await this.logActivity(userId, 'status_set', connection.workspace_id, {
        status_text: statusText,
        status_emoji: statusEmoji,
        expiration
      })
    } catch (error) {
      await this.logActivity(userId, 'error', connection.workspace_id, null, false, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  static async clearUserStatus(userId: string): Promise<void> {
    const connection = await this.getActiveUserConnection(userId)
    if (!connection) {
      throw new ApiError('No active Slack connection found', 404)
    }

    const token = SlackOAuthService.getDecryptedToken(connection.access_token)
    
    try {
      const response = await fetch('https://slack.com/api/users.profile.set', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: {
            status_text: '',
            status_emoji: '',
            status_expiration: 0
          }
        })
      })

      const data = await response.json() as SlackUserProfile
      
      if (!data.ok) {
        throw new ApiError(`Failed to clear Slack status: ${data.error}`, 400)
      }

      await this.logActivity(userId, 'status_cleared', connection.workspace_id)
    } catch (error) {
      await this.logActivity(userId, 'error', connection.workspace_id, null, false, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  static async enableDnd(userId: string, durationMinutes: number): Promise<void> {
    const connection = await this.getActiveUserConnection(userId)
    if (!connection) {
      throw new ApiError('No active Slack connection found', 404)
    }

    const token = SlackOAuthService.getDecryptedToken(connection.access_token)
    
    try {
      const response = await fetch('https://slack.com/api/dnd.setSnooze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          num_minutes: durationMinutes.toString()
        })
      })

      const data = await response.json() as SlackDndResponse
      
      if (!data.ok) {
        throw new ApiError(`Failed to enable Slack DND: ${data.error}`, 400)
      }

      await this.logActivity(userId, 'dnd_enabled', connection.workspace_id, {
        duration_minutes: durationMinutes
      })
    } catch (error) {
      await this.logActivity(userId, 'error', connection.workspace_id, null, false, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  static async disableDnd(userId: string): Promise<void> {
    const connection = await this.getActiveUserConnection(userId)
    if (!connection) {
      throw new ApiError('No active Slack connection found', 404)
    }

    const token = SlackOAuthService.getDecryptedToken(connection.access_token)
    
    try {
      const response = await fetch('https://slack.com/api/dnd.endSnooze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      const data = await response.json() as SlackDndResponse
      
      if (!data.ok) {
        throw new ApiError(`Failed to disable Slack DND: ${data.error}`, 400)
      }

      await this.logActivity(userId, 'dnd_disabled', connection.workspace_id)
    } catch (error) {
      await this.logActivity(userId, 'error', connection.workspace_id, null, false, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  static async getDndInfo(userId: string): Promise<any> {
    const connection = await this.getActiveUserConnection(userId)
    if (!connection) {
      throw new ApiError('No active Slack connection found', 404)
    }

    const token = SlackOAuthService.getDecryptedToken(connection.access_token)
    
    try {
      const response = await fetch('https://slack.com/api/dnd.info', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json() as SlackDndInfo
      
      if (!data.ok) {
        throw new ApiError(`Failed to get Slack DND info: ${data.error}`, 400)
      }

      return {
        dnd_enabled: data.dnd_enabled,
        next_dnd_start_ts: data.next_dnd_start_ts,
        next_dnd_end_ts: data.next_dnd_end_ts
      }
    } catch (error) {
      await this.logActivity(userId, 'error', connection.workspace_id, null, false, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  static async startFocusSession(userId: string, sessionId?: string, durationMinutes?: number): Promise<void> {
    const preferences = await this.getUserPreferences(userId)
    console.log('preferences', preferences)
    if (!preferences?.enabled) {
      return // User has Slack integration disabled
    }

    console.log('preferences.auto_status_update', preferences.auto_status_update)
    console.log('preferences.auto_dnd', preferences.auto_dnd)
    console.log('preferences.custom_status_text', preferences.custom_status_text)
    console.log('preferences.custom_status_emoji', preferences.custom_status_emoji)
    console.log('durationMinutes', durationMinutes)

    const promises: Promise<void>[] = []

    if (preferences.auto_status_update) {
      console.log('setting status')
      promises.push(
        this.setUserStatus(
          userId,
          preferences.custom_status_text || 'Focusing with Ebb',
          preferences.custom_status_emoji || ':brain:',
          durationMinutes ? Math.floor(Date.now() / 1000) + (durationMinutes * 60) : undefined
        )
      )
    }

    if (preferences.auto_dnd && durationMinutes) {
      console.log('enabling dnd')
      promises.push(this.enableDnd(userId, durationMinutes))
    }

    await Promise.allSettled(promises)
  }

  static async endFocusSession(userId: string, sessionId?: string): Promise<void> {
    const preferences = await this.getUserPreferences(userId)
    if (!preferences?.enabled) {
      return // User has Slack integration disabled
    }

    const promises: Promise<void>[] = []

    if (preferences.auto_status_update) {
      promises.push(this.clearUserStatus(userId))
    }

    if (preferences.auto_dnd) {
      promises.push(this.disableDnd(userId))
    }

    await Promise.allSettled(promises)
  }

  private static async getActiveUserConnection(userId: string): Promise<any> {
    return await db('slack_user_connections')
      .where({ user_id: userId, is_active: true })
      .first()
  }

  private static async getUserPreferences(userId: string): Promise<any> {
    return await db('slack_preferences')
      .where({ user_id: userId })
      .first()
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
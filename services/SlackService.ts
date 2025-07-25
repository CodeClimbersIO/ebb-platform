import { SlackRepo } from '../repos/Slack.js'
import { SlackOAuthService } from './SlackOAuthService.js'
import { ApiError } from '../middleware/errorHandler.js'
import { mapSlackError, shouldRetryError, getRetryDelay, type SlackErrorDetails } from '../utils/slackErrorMapper.js'
import { JobService } from './JobService.js'
import { JOB_QUEUES, JOB_TYPES, JOB_PRIORITIES, type SlackCleanupJobData } from '../types/jobs.js'

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

interface WorkspaceResult {
  team_name: string
  workspace_id: string
  success: boolean
  dnd_enabled?: boolean
  status_updated?: boolean
  error?: SlackErrorDetails
  next_dnd_start_ts?: number
  next_dnd_end_ts?: number
}

interface MultiWorkspaceResponse {
  overall_success: boolean
  workspaces: WorkspaceResult[]
}

const setUserStatus = async (userId: string, statusText: string, statusEmoji: string, expiration?: number): Promise<MultiWorkspaceResponse> => {
  const preferences = await SlackRepo.getUserPreferences(userId)
  
  if (!preferences.enabled) {
    return {
      overall_success: true,
      workspaces: []
    }
  }

  const connections = await SlackRepo.getAllActiveUserConnections(userId)
  
  if (connections.length === 0) {
    throw new ApiError('No active Slack connections found', 404)
  }

  const workspaceResults: WorkspaceResult[] = []

  // Process each workspace
  for (const connection of connections) {
    const workspaceResult: WorkspaceResult = {
      team_name: connection.team_name,
      workspace_id: connection.workspace_id,
      success: true,
      status_updated: false
    }

    try {
      const token = SlackOAuthService.getDecryptedToken(connection.access_token)
      
      await executeWithRetry(async () => {
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
          throw new Error(data.error || 'Unknown error')
        }
      })
      
      workspaceResult.status_updated = true

      await SlackRepo.createSessionActivity({
        user_id: userId,
        activity_type: 'status_set',
        slack_workspace_id: connection.workspace_id,
        details: JSON.stringify({
          status_text: statusText,
          status_emoji: statusEmoji,
          expiration
        })
      })

    } catch (error) {
      workspaceResult.success = false
      const slackError = error instanceof Error ? error.message : 'Unknown error'
      workspaceResult.error = mapSlackError(slackError)

      await SlackRepo.createSessionActivity({
        user_id: userId,
        activity_type: 'error',
        slack_workspace_id: connection.workspace_id,
        details: JSON.stringify({ action: 'set_status', status_text: statusText, status_emoji: statusEmoji }),
        success: false,
        error_message: slackError
      })
    }

    workspaceResults.push(workspaceResult)
  }

  const overallSuccess = workspaceResults.some(w => w.success)

  return {
    overall_success: overallSuccess,
    workspaces: workspaceResults
  }
}

const clearUserStatus = async (userId: string): Promise<MultiWorkspaceResponse> => {
  const preferences = await SlackRepo.getUserPreferences(userId)
  
  if (!preferences.enabled) {
    return {
      overall_success: true,
      workspaces: []
    }
  }

  const connections = await SlackRepo.getAllActiveUserConnections(userId)
  
  if (connections.length === 0) {
    throw new ApiError('No active Slack connections found', 404)
  }

  const workspaceResults: WorkspaceResult[] = []

  // Process each workspace
  for (const connection of connections) {
    const workspaceResult: WorkspaceResult = {
      team_name: connection.team_name,
      workspace_id: connection.workspace_id,
      success: true,
      status_updated: false
    }

    try {
      const token = SlackOAuthService.getDecryptedToken(connection.access_token)
      
      await executeWithRetry(async () => {
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
          throw new Error(data.error || 'Unknown error')
        }
      })
      
      workspaceResult.status_updated = true

      await SlackRepo.createSessionActivity({
        user_id: userId,
        activity_type: 'status_cleared',
        slack_workspace_id: connection.workspace_id
      })

    } catch (error) {
      workspaceResult.success = false
      const slackError = error instanceof Error ? error.message : 'Unknown error'
      workspaceResult.error = mapSlackError(slackError)

      await SlackRepo.createSessionActivity({
        user_id: userId,
        activity_type: 'error',
        slack_workspace_id: connection.workspace_id,
        details: JSON.stringify({ action: 'clear_status' }),
        success: false,
        error_message: slackError
      })
    }

    workspaceResults.push(workspaceResult)
  }

  const overallSuccess = workspaceResults.some(w => w.success)

  return {
    overall_success: overallSuccess,
    workspaces: workspaceResults
  }
}

const enableDnd = async (userId: string, durationMinutes: number): Promise<MultiWorkspaceResponse> => {
  const preferences = await SlackRepo.getUserPreferences(userId)
  
  if (!preferences.enabled) {
    return {
      overall_success: true,
      workspaces: []
    }
  }

  const connections = await SlackRepo.getAllActiveUserConnections(userId)
  
  if (connections.length === 0) {
    throw new ApiError('No active Slack connections found', 404)
  }

  const workspaceResults: WorkspaceResult[] = []

  // Process each workspace
  for (const connection of connections) {
    const workspaceResult: WorkspaceResult = {
      team_name: connection.team_name,
      workspace_id: connection.workspace_id,
      success: true,
      dnd_enabled: false
    }

    try {
      const token = SlackOAuthService.getDecryptedToken(connection.access_token)
      
      await executeWithRetry(async () => {
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
          throw new Error(data.error || 'Unknown error')
        }
      })
      
      workspaceResult.dnd_enabled = true

      await SlackRepo.createSessionActivity({
        user_id: userId,
        activity_type: 'dnd_enabled',
        slack_workspace_id: connection.workspace_id,
        details: JSON.stringify({
          duration_minutes: durationMinutes
        })
      })

    } catch (error) {
      workspaceResult.success = false
      const slackError = error instanceof Error ? error.message : 'Unknown error'
      workspaceResult.error = mapSlackError(slackError)

      await SlackRepo.createSessionActivity({
        user_id: userId,
        activity_type: 'error',
        slack_workspace_id: connection.workspace_id,
        details: JSON.stringify({ action: 'enable_dnd', duration_minutes: durationMinutes }),
        success: false,
        error_message: slackError
      })
    }

    workspaceResults.push(workspaceResult)
  }

  const overallSuccess = workspaceResults.some(w => w.success)

  return {
    overall_success: overallSuccess,
    workspaces: workspaceResults
  }
}

const disableDnd = async (userId: string): Promise<MultiWorkspaceResponse> => {
  const preferences = await SlackRepo.getUserPreferences(userId)
  
  if (!preferences.enabled) {
    return {
      overall_success: true,
      workspaces: []
    }
  }

  const connections = await SlackRepo.getAllActiveUserConnections(userId)
  
  if (connections.length === 0) {
    throw new ApiError('No active Slack connections found', 404)
  }

  const workspaceResults: WorkspaceResult[] = []

  // Process each workspace
  for (const connection of connections) {
    const workspaceResult: WorkspaceResult = {
      team_name: connection.team_name,
      workspace_id: connection.workspace_id,
      success: true,
      dnd_enabled: false
    }

    try {
      const token = SlackOAuthService.getDecryptedToken(connection.access_token)
      
      await executeWithRetry(async () => {
        const response = await fetch('https://slack.com/api/dnd.endSnooze', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })

        const data = await response.json() as SlackDndResponse
        
        if (!data.ok) {
          throw new Error(data.error || 'Unknown error')
        }
      })
      
      workspaceResult.dnd_enabled = true

      await SlackRepo.createSessionActivity({
        user_id: userId,
        activity_type: 'dnd_disabled',
        slack_workspace_id: connection.workspace_id
      })

    } catch (error) {
      workspaceResult.success = false
      const slackError = error instanceof Error ? error.message : 'Unknown error'
      workspaceResult.error = mapSlackError(slackError)

      await SlackRepo.createSessionActivity({
        user_id: userId,
        activity_type: 'error',
        slack_workspace_id: connection.workspace_id,
        details: JSON.stringify({ action: 'disable_dnd' }),
        success: false,
        error_message: slackError
      })
    }

    workspaceResults.push(workspaceResult)
  }

  const overallSuccess = workspaceResults.some(w => w.success)

  return {
    overall_success: overallSuccess,
    workspaces: workspaceResults
  }
}

const getDndInfo = async (userId: string): Promise<any> => {
  const preferences = await SlackRepo.getUserPreferences(userId)
  
  if (!preferences.enabled) {
    return {
      slack_enabled: false,
      workspaces: []
    }
  }

  const connections = await SlackRepo.getAllActiveUserConnections(userId)
  
  if (connections.length === 0) {
    throw new ApiError('No active Slack connections found', 404)
  }

  const workspaceResults: WorkspaceResult[] = []

  // Get DND info for each workspace
  for (const connection of connections) {
    const workspaceResult: WorkspaceResult = {
      team_name: connection.team_name,
      workspace_id: connection.workspace_id,
      success: true,
      dnd_enabled: false
    }

    try {
      const token = SlackOAuthService.getDecryptedToken(connection.access_token)
      
      const response = await fetch('https://slack.com/api/dnd.info', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json() as SlackDndInfo
      
      if (!data.ok) {
        throw new Error(data.error || 'Unknown error')
      }

      workspaceResult.dnd_enabled = data.dnd_enabled || false
      workspaceResult.next_dnd_start_ts = data.next_dnd_start_ts 
      workspaceResult.next_dnd_end_ts = data.next_dnd_end_ts

    } catch (error) {
      workspaceResult.success = false
      const slackError = error instanceof Error ? error.message : 'Unknown error'
      workspaceResult.error = mapSlackError(slackError)

      await SlackRepo.createSessionActivity({
        user_id: userId,
        activity_type: 'error',
        slack_workspace_id: connection.workspace_id,
        details: JSON.stringify({ action: 'get_dnd_info' }),
        success: false,
        error_message: slackError
      })
    }

    workspaceResults.push(workspaceResult)
  }

  return {
    slack_enabled: true,
    workspaces: workspaceResults
  }
}

const startFocusSession = async (userId: string, sessionId?: string, durationMinutes?: number): Promise<MultiWorkspaceResponse> => {
  const preferences = await SlackRepo.getUserPreferences(userId)
  
  if (!preferences.enabled) {
    return {
      overall_success: true,
      workspaces: []
    }
  }

  const connections = await SlackRepo.getAllActiveUserConnections(userId)
  
  if (connections.length === 0) {
    throw new ApiError('No active Slack connections found', 404)
  }

  // Create focus session record
  const actualSessionId = sessionId || `focus-session-${Date.now()}`
  const expiration = durationMinutes ? Math.floor(Date.now() / 1000) + (durationMinutes * 60) : undefined
  
  const focusSession = await SlackRepo.createFocusSession({
    user_id: userId,
    session_id: actualSessionId,
    duration_minutes: durationMinutes,
    is_active: true
  })

  const workspaceResults: WorkspaceResult[] = []

  // Process each workspace
  for (const connection of connections) {
    const workspaceResult: WorkspaceResult = {
      team_name: connection.team_name,
      workspace_id: connection.workspace_id,
      success: true,
      status_updated: false,
      dnd_enabled: false
    }

    try {
      const token = SlackOAuthService.getDecryptedToken(connection.access_token)

      // Update status if enabled
      if (preferences.auto_status_update) {
        await executeWithRetry(async () => {
          const response = await fetch('https://slack.com/api/users.profile.set', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              profile: {
                status_text: preferences.custom_status_text || 'Focusing with Ebb',
                status_emoji: preferences.custom_status_emoji || ':brain:',
                status_expiration: expiration || 0
              }
            })
          })

          const data = await response.json() as SlackUserProfile
          
          if (!data.ok) {
            throw new Error(data.error || 'Unknown error')
          }
        })
        
        workspaceResult.status_updated = true
      }

      // Enable DND if enabled and duration provided
      if (preferences.auto_dnd && durationMinutes) {
        await executeWithRetry(async () => {
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
            throw new Error(data.error || 'Unknown error')
          }
        })
        
        workspaceResult.dnd_enabled = true
      }

      // Log successful activities
      if (workspaceResult.status_updated) {
        await SlackRepo.createSessionActivity({
          user_id: userId,
          activity_type: 'status_set',
          slack_workspace_id: connection.workspace_id,
          details: JSON.stringify({
            session_id: actualSessionId,
            status_text: preferences.custom_status_text || 'Focusing with Ebb',
            status_emoji: preferences.custom_status_emoji || ':brain:',
            expiration
          })
        })
      }

      if (workspaceResult.dnd_enabled) {
        await SlackRepo.createSessionActivity({
          user_id: userId,
          activity_type: 'dnd_enabled',
          slack_workspace_id: connection.workspace_id,
          details: JSON.stringify({
            session_id: actualSessionId,
            duration_minutes: durationMinutes
          })
        })
      }

    } catch (error) {
      workspaceResult.success = false
      const slackError = error instanceof Error ? error.message : 'Unknown error'
      workspaceResult.error = mapSlackError(slackError)

      // Log error
      await SlackRepo.createSessionActivity({
        user_id: userId,
        activity_type: 'error',
        slack_workspace_id: connection.workspace_id,
        details: JSON.stringify({ session_id: actualSessionId, action: 'start_focus_session' }),
        success: false,
        error_message: slackError
      })
    }

    // Store workspace session state
    await SlackRepo.createFocusSessionWorkspace({
      session_id: focusSession.id,
      workspace_id: connection.workspace_id,
      status_updated: workspaceResult.status_updated || false,
      dnd_enabled: workspaceResult.dnd_enabled || false,
      error_message: workspaceResult.error?.message,
      error_type: workspaceResult.error?.type
    })

    workspaceResults.push(workspaceResult)
  }

  const overallSuccess = workspaceResults.some(w => w.success)

  // Schedule cleanup job if duration is specified and session has DND or status enabled
  if (durationMinutes && overallSuccess) {
    const needsDndCleanup = workspaceResults.some(w => w.dnd_enabled)
    const needsStatusCleanup = workspaceResults.some(w => w.status_updated)
    
    if (needsDndCleanup || needsStatusCleanup) {
      const cleanupDelay = durationMinutes * 60 * 1000 // Convert minutes to milliseconds
      
      try {
        await JobService.addJob({
          queue: JOB_QUEUES.SLACK_CLEANUP,
          jobType: JOB_TYPES.SLACK_CLEANUP_DND,
          data: {
            sessionId: actualSessionId,
            userId
          } as SlackCleanupJobData,
          delay: cleanupDelay,
          priority: JOB_PRIORITIES.NORMAL
        })
      } catch (error) {
        console.error('Failed to schedule Slack cleanup job:', error)
        // Don't fail the session start if job scheduling fails
      }
    }
  }

  return {
    overall_success: overallSuccess,
    workspaces: workspaceResults
  }
}

const endFocusSession = async (userId: string): Promise<MultiWorkspaceResponse> => {
  const preferences = await SlackRepo.getUserPreferences(userId)
  
  if (!preferences.enabled) {
    return {
      overall_success: true,
      workspaces: []
    }
  }

  // Get all active focus sessions for the user
  const activeSessions = await SlackRepo.getAllActiveFocusSessions(userId)
  
  if (activeSessions.length === 0) {
    throw new ApiError('No active focus sessions found', 404)
  }

  const workspaceResults: WorkspaceResult[] = []

  // Process each active session
  for (const session of activeSessions) {
    // Get workspace states for this session
    const sessionWorkspaces = await SlackRepo.getFocusSessionWorkspaces(session.id, userId)

    // Process each workspace that was part of the session
    for (const sessionWorkspace of sessionWorkspaces) {
      const workspaceResult: WorkspaceResult = {
        team_name: sessionWorkspace.team_name,
        workspace_id: sessionWorkspace.workspace_id,
        success: true,
        status_updated: false,
        dnd_enabled: false
      }

      try {
        const token = SlackOAuthService.getDecryptedToken(sessionWorkspace.access_token)

        // Clear status if it was set during session
        if (sessionWorkspace.status_updated && preferences.auto_status_update) {
          await executeWithRetry(async () => {
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
              throw new Error(data.error || 'Unknown error')
            }
          })
          
          workspaceResult.status_updated = true
        }

        // Disable DND if it was enabled during session
        if (sessionWorkspace.dnd_enabled && preferences.auto_dnd) {
          await executeWithRetry(async () => {
            const response = await fetch('https://slack.com/api/dnd.endSnooze', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            })

            const data = await response.json() as SlackDndResponse
            
            if (!data.ok) {
              throw new Error(data.error || 'Unknown error')
            }
          })
          
          workspaceResult.dnd_enabled = true
        }

        // Log successful activities
        if (workspaceResult.status_updated) {
          await SlackRepo.createSessionActivity({
            user_id: userId,
            activity_type: 'status_cleared',
            slack_workspace_id: sessionWorkspace.workspace_id,
            details: JSON.stringify({
              session_id: session.session_id
            })
          })
        }

        if (workspaceResult.dnd_enabled) {
          await SlackRepo.createSessionActivity({
            user_id: userId,
            activity_type: 'dnd_disabled',
            slack_workspace_id: sessionWorkspace.workspace_id,
            details: JSON.stringify({
              session_id: session.session_id
            })
          })
        }

      } catch (error) {
        workspaceResult.success = false
        const slackError = error instanceof Error ? error.message : 'Unknown error'
        workspaceResult.error = mapSlackError(slackError)

        // Log error
        await SlackRepo.createSessionActivity({
          user_id: userId,
          activity_type: 'error',
          slack_workspace_id: sessionWorkspace.workspace_id,
          details: JSON.stringify({ session_id: session.session_id, action: 'end_focus_session' }),
          success: false,
          error_message: slackError
        })
      }

      workspaceResults.push(workspaceResult)
    }
  }

  // Mark all sessions as ended
  await SlackRepo.endAllActiveFocusSessions(userId)

  const overallSuccess = workspaceResults.length === 0 || workspaceResults.some(w => w.success)

  return {
    overall_success: overallSuccess,
    workspaces: workspaceResults
  }
}

const getActiveSessionId = async (userId: string): Promise<string | null> => {
  const session = await SlackRepo.getActiveFocusSession(userId)
  return session?.session_id || null
}

const getFocusSessionStatus = async (userId: string): Promise<any> => {
  const preferences = await SlackRepo.getUserPreferences(userId)
  
  if (!preferences.enabled) {
    return {
      active_session: null,
      slack_enabled: false
    }
  }

  const activeSessionData = await SlackRepo.getFocusSessionStatus(userId)
  
  if (!activeSessionData) {
    return {
      active_session: null,
      slack_enabled: true
    }
  }

  return {
    active_session: activeSessionData,
    slack_enabled: true
  }
}

const getActiveUserConnection = async (userId: string): Promise<any> => {
  return await SlackRepo.getActiveUserConnection(userId)
}

const getAllActiveUserConnections = async (userId: string): Promise<any[]> => {
  return await SlackRepo.getAllActiveUserConnections(userId)
}

const getUserPreferences = async (userId: string): Promise<any> => {
  return await SlackRepo.getUserPreferences(userId)
}

const logActivity = async (
  userId: string,
  activityType: string,
  workspaceId?: string,
  details?: any,
  success: boolean = true,
  errorMessage?: string
): Promise<void> => {
  try {
    await SlackRepo.createSessionActivity({
      user_id: userId,
      activity_type: activityType,
      slack_workspace_id: workspaceId,
      details: details ? JSON.stringify(details) : undefined,
      success,
      error_message: errorMessage
    })
  } catch (error) {
    console.error('Failed to log Slack activity:', error)
  }
}

const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> => {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // Extract Slack error from message
      const slackError = error instanceof Error ? 
        (error.message.includes('Failed to') ? error.message.split(': ')[1] : error.message) : 
        'unknown_error'
      
      const mappedError = mapSlackError(slackError || 'unknown_error')
      
      // Don't retry permission errors
      if (!shouldRetryError(mappedError.type)) {
        throw error
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt + 1)))
    }
  }
  
  throw lastError!
}

const cleanupExpiredFocusSession = async (sessionId: string, userId: string): Promise<void> => {
  try {
    // Find the focus session
    const focusSession = await SlackRepo.getFocusSessionById(userId, sessionId)
    
    if (!focusSession) {
      console.log(`Focus session ${sessionId} not found or already ended`)
      return
    }

    // Check if session has expired (duration + some buffer)
    const sessionStart = new Date(focusSession.start_time).getTime()
    const durationMs = (focusSession.duration_minutes || 0) * 60 * 1000
    const now = Date.now()
    const expiredTime = sessionStart + durationMs

    if (now < expiredTime - 60000) { // 1 minute buffer
      console.log(`Focus session ${sessionId} has not expired yet`)
      return
    }

    console.log(`Cleaning up expired focus session ${sessionId} for user ${userId}`)

    // Get workspace states for this session
    const sessionWorkspaces = await SlackRepo.getFocusSessionWorkspaces(focusSession.id, userId)

    // Get user preferences
    const preferences = await SlackRepo.getUserPreferences(userId)
    
    if (!preferences.enabled) {
      return
    }

    // Clean up each workspace
    for (const sessionWorkspace of sessionWorkspaces) {
      try {
        const token = SlackOAuthService.getDecryptedToken(sessionWorkspace.access_token)

        // Clear status if it was set during session
        if (sessionWorkspace.status_updated && preferences.auto_status_update) {
          await executeWithRetry(async () => {
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
              throw new Error(data.error || 'Unknown error')
            }
          })

          await logActivity(userId, 'status_cleared', sessionWorkspace.workspace_id, {
            session_id: sessionId,
            cleanup_type: 'expired'
          })
        }

        // Disable DND if it was enabled during session
        if (sessionWorkspace.dnd_enabled && preferences.auto_dnd) {
          await executeWithRetry(async () => {
            const response = await fetch('https://slack.com/api/dnd.endSnooze', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            })

            const data = await response.json() as SlackDndResponse
            
            if (!data.ok) {
              throw new Error(data.error || 'Unknown error')
            }
          })

          await logActivity(userId, 'dnd_disabled', sessionWorkspace.workspace_id, {
            session_id: sessionId,
            cleanup_type: 'expired'
          })
        }

      } catch (error) {
        const slackError = error instanceof Error ? error.message : 'Unknown error'
        
        await logActivity(
          userId, 
          'error', 
          sessionWorkspace.workspace_id, 
          { session_id: sessionId, action: 'cleanup_expired', cleanup_type: 'expired' }, 
          false, 
          slackError
        )
        
        console.error(`Failed to cleanup workspace ${sessionWorkspace.team_name}:`, error)
      }
    }

    // Mark session as ended
    await SlackRepo.updateFocusSession(focusSession.id, {
      is_active: false,
      end_time: new Date()
    })

    console.log(`Successfully cleaned up expired focus session ${sessionId}`)

  } catch (error) {
    console.error(`Error during cleanup of session ${sessionId}:`, error)
    throw error
  }
}

export const SlackService = {
  setUserStatus,
  clearUserStatus,
  enableDnd,
  disableDnd,
  getDndInfo,
  startFocusSession,
  endFocusSession,
  getFocusSessionStatus,
  cleanupExpiredFocusSession
}
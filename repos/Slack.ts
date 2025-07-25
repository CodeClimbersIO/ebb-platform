import { db } from '../config/database.js'

export interface SlackWorkspace {
  id: string
  team_id: string
  team_name: string
  bot_token: string
}

export interface SlackUserConnection {
  id: string
  user_id: string
  workspace_id: string
  access_token: string
  team_name: string
  team_id: string
  bot_token: string
  is_active: boolean
}

export interface SlackPreferences {
  user_id: string
  enabled: boolean
  auto_status_update: boolean
  auto_dnd: boolean
  auto_reply_enabled: boolean
  custom_status_text: string
  custom_status_emoji: string
  auto_reply_message: string
  urgent_keywords: string
}

export interface SlackFocusSession {
  id: number
  user_id: string
  session_id: string
  duration_minutes?: number
  is_active: boolean
  start_time: Date
  end_time?: Date
}

export interface SlackFocusSessionWorkspace {
  id: number
  session_id: number
  workspace_id: string
  status_updated: boolean
  dnd_enabled: boolean
  error_message?: string
  error_type?: string
}

export interface SlackSessionActivity {
  id: number
  user_id: string
  activity_type: string
  slack_workspace_id?: string
  details?: string
  success: boolean
  error_message?: string
  created_at: Date
}

export interface SlackOAuthState {
  id: number
  state_token: string
  user_id: string
  expires_at: Date
  created_at: Date
}

const getWorkspaceByTeamId = async (teamId: string): Promise<SlackWorkspace | undefined> => {
  return await db('slack_workspaces')
    .where({ team_id: teamId })
    .first()
}

// Default preferences applied at runtime (not in database)
const DEFAULT_PREFERENCES = {
  enabled: true,
  auto_status_update: true,
  auto_dnd: true,
  auto_reply_enabled: false,
  custom_status_text: 'Focusing with Ebb',
  custom_status_emoji: ':brain:',
  auto_reply_message: 'I\'m currently in a focus session. I\'ll get back to you soon!',
  urgent_keywords: '["urgent", "emergency", "asap", "help"]'
} as const

const getUserPreferences = async (userId: string): Promise<SlackPreferences> => {
  const userPrefs = await db('slack_preferences')
    .where({ user_id: userId })
    .first()

  // If no preferences exist, return runtime defaults
  if (!userPrefs) {
    return {
      user_id: userId,
      ...DEFAULT_PREFERENCES
    }
  }

  // Merge user preferences with defaults for any missing fields
  return {
    user_id: userId,
    enabled: userPrefs.enabled ?? DEFAULT_PREFERENCES.enabled,
    auto_status_update: userPrefs.auto_status_update ?? DEFAULT_PREFERENCES.auto_status_update,
    auto_dnd: userPrefs.auto_dnd ?? DEFAULT_PREFERENCES.auto_dnd,
    auto_reply_enabled: userPrefs.auto_reply_enabled ?? DEFAULT_PREFERENCES.auto_reply_enabled,
    custom_status_text: userPrefs.custom_status_text ?? DEFAULT_PREFERENCES.custom_status_text,
    custom_status_emoji: userPrefs.custom_status_emoji ?? DEFAULT_PREFERENCES.custom_status_emoji,
    auto_reply_message: userPrefs.auto_reply_message ?? DEFAULT_PREFERENCES.auto_reply_message,
    urgent_keywords: userPrefs.urgent_keywords ?? DEFAULT_PREFERENCES.urgent_keywords
  }
}

const getActiveUserConnection = async (userId: string): Promise<SlackUserConnection | undefined> => {
  return await db('slack_user_connections')
    .where({ user_id: userId, is_active: true })
    .first()
}

const getAllActiveUserConnections = async (userId: string): Promise<SlackUserConnection[]> => {
  return await db('slack_user_connections as suc')
    .join('slack_workspaces as sw', 'suc.workspace_id', 'sw.id')
    .where({ 'suc.user_id': userId, 'suc.is_active': true })
    .select(
      'suc.id as connection_id',
      'suc.access_token',
      'suc.workspace_id',
      'sw.team_name',
      'sw.team_id',
      'sw.bot_token'
    )
}

const getUserConnectionWithPreferences = async (workspaceId: string): Promise<any> => {
  return await db('slack_user_connections as suc')
    .join('slack_preferences as sp', 'suc.user_id', 'sp.user_id')
    .where({
      'suc.workspace_id': workspaceId,
      'suc.is_active': true,
      'sp.enabled': true,
      'sp.auto_reply_enabled': true
    })
    .select('suc.*', 'sp.*')
    .first()
}

const createFocusSession = async (sessionData: {
  user_id: string
  session_id: string
  duration_minutes?: number
  is_active: boolean
}): Promise<SlackFocusSession> => {
  const [focusSession] = await db('slack_focus_sessions')
    .insert(sessionData)
    .returning('*')
  return focusSession
}

const createFocusSessionWorkspace = async (workspaceData: {
  session_id: number
  workspace_id: string
  status_updated: boolean
  dnd_enabled: boolean
  error_message?: string
  error_type?: string
}): Promise<void> => {
  await db('slack_focus_session_workspaces').insert(workspaceData)
}

const getActiveFocusSession = async (userId: string): Promise<SlackFocusSession | undefined> => {
  return await db('slack_focus_sessions')
    .where({ user_id: userId, is_active: true })
    .orderBy('start_time', 'desc')
    .first()
}

const getFocusSessionById = async (userId: string, sessionId: string): Promise<SlackFocusSession | undefined> => {
  return await db('slack_focus_sessions')
    .where({ user_id: userId, session_id: sessionId, is_active: true })
    .first()
}

const getFocusSessionWorkspaces = async (sessionId: number, userId: string): Promise<any[]> => {
  return await db('slack_focus_session_workspaces as sfw')
    .join('slack_workspaces as sw', 'sfw.workspace_id', 'sw.id')
    .join('slack_user_connections as suc', 'sfw.workspace_id', 'suc.workspace_id')
    .where({ 
      'sfw.session_id': sessionId,
      'suc.user_id': userId,
      'suc.is_active': true
    })
    .select(
      'sfw.*',
      'sw.team_name',
      'sw.team_id',
      'suc.access_token'
    )
}

const updateFocusSession = async (sessionId: number, updates: {
  is_active?: boolean
  end_time?: Date
}): Promise<void> => {
  await db('slack_focus_sessions')
    .where({ id: sessionId })
    .update(updates)
}

const getAllActiveFocusSessions = async (userId: string): Promise<SlackFocusSession[]> => {
  return await db('slack_focus_sessions')
    .where({ user_id: userId, is_active: true })
    .orderBy('start_time', 'desc')
}

const endAllActiveFocusSessions = async (userId: string): Promise<void> => {
  await db('slack_focus_sessions')
    .where({ user_id: userId, is_active: true })
    .update({ 
      is_active: false, 
      end_time: new Date() 
    })
}

const updateExpiredFocusSession = async (sessionId: number): Promise<void> => {
  await db('slack_focus_sessions')
    .where({ id: sessionId })
    .update({ 
      is_active: false, 
      end_time: new Date() 
    })
}

const getFocusSessionStatus = async (userId: string): Promise<any> => {
  const activeSession = await db('slack_focus_sessions')
    .where({ user_id: userId, is_active: true })
    .orderBy('start_time', 'desc')
    .first()

  if (!activeSession) {
    return null
  }

  const workspaceStates = await db('slack_focus_session_workspaces as sfw')
    .join('slack_workspaces as sw', 'sfw.workspace_id', 'sw.id')
    .where({ 'sfw.session_id': activeSession.id })
    .select(
      'sw.team_name',
      'sfw.status_updated',
      'sfw.dnd_enabled',
      'sfw.error_message',
      'sfw.error_type'
    )

  const workspaces = workspaceStates.map(ws => ({
    team_name: ws.team_name,
    status_updated: ws.status_updated,
    dnd_enabled: ws.dnd_enabled,
    error: ws.error_message ? {
      type: ws.error_type,
      message: ws.error_message
    } : null
  }))

  return {
    session_id: activeSession.session_id,
    start_time: activeSession.start_time,
    duration_minutes: activeSession.duration_minutes,
    workspaces
  }
}

const createSessionActivity = async (activityData: {
  user_id: string
  activity_type: string
  slack_workspace_id?: string
  details?: string
  success?: boolean
  error_message?: string
}): Promise<void> => {
  await db('slack_session_activities').insert({
    ...activityData,
    success: activityData.success ?? true
  })
}

const createOAuthState = async (stateData: {
  state_token: string
  user_id: string
  expires_at: Date
}): Promise<void> => {
  await db('slack_oauth_states').insert(stateData)
}

const getOAuthState = async (stateToken: string): Promise<SlackOAuthState | undefined> => {
  return await db('slack_oauth_states')
    .where({ state_token: stateToken })
    .where('expires_at', '>', new Date())
    .first()
}

const deleteOAuthState = async (stateToken: string): Promise<void> => {
  await db('slack_oauth_states').where({ state_token: stateToken }).del()
}

const upsertWorkspace = async (workspaceData: {
  team_id: string
  team_name: string
  team_domain?: string
  bot_token: string
  bot_user_id: string
  app_id: string
  scope: string
}): Promise<SlackWorkspace> => {
  const existing = await db('slack_workspaces').where({ team_id: workspaceData.team_id }).first()
  
  if (existing) {
    const [updated] = await db('slack_workspaces')
      .where({ team_id: workspaceData.team_id })
      .update({ ...workspaceData, updated_at: new Date() })
      .returning('*')
    return updated
  } else {
    const [created] = await db('slack_workspaces').insert(workspaceData).returning('*')
    return created
  }
}

const upsertUserConnection = async (connectionData: {
  user_id: string
  workspace_id: string
  slack_user_id: string
  access_token: string
  scope: string
}): Promise<SlackUserConnection> => {
  const existing = await db('slack_user_connections')
    .where({ user_id: connectionData.user_id, workspace_id: connectionData.workspace_id })
    .first()
  
  if (existing) {
    const [updated] = await db('slack_user_connections')
      .where({ user_id: connectionData.user_id, workspace_id: connectionData.workspace_id })
      .update({ ...connectionData, is_active: true, updated_at: new Date() })
      .returning('*')
    return updated
  } else {
    const [created] = await db('slack_user_connections')
      .insert({ ...connectionData, is_active: true })
      .returning('*')
    return created
  }
}


const disconnectUserConnections = async (userId: string): Promise<void> => {
  await db('slack_user_connections')
    .where({ user_id: userId })
    .update({ is_active: false })
}

const disconnectUserWorkspace = async (userId: string, workspaceId: string): Promise<void> => {
  await db('slack_user_connections')
    .where({ user_id: userId, workspace_id: workspaceId })
    .update({ is_active: false })
}

const getUserSlackConnections = async (userId: string): Promise<any[]> => {
  return db('slack_user_connections as suc')
    .join('slack_workspaces as sw', 'suc.workspace_id', 'sw.id')
    .where({ 'suc.user_id': userId, 'suc.is_active': true })
    .select('sw.team_name', 'sw.team_domain', 'sw.team_id', 'sw.id', 'suc.created_at')
}

const updateUserPreferences = async (userId: string, updates: {
  enabled?: boolean
  auto_status_update?: boolean
  auto_dnd?: boolean
  custom_status_text?: string
  custom_status_emoji?: string
  auto_reply_enabled?: boolean
  auto_reply_message?: string
  urgent_keywords?: string[]
}): Promise<SlackPreferences> => {
  const existing = await db('slack_preferences').where({ user_id: userId }).first()
  
  if (existing) {
    await db('slack_preferences')
      .where({ user_id: userId })
      .update({
        ...updates,
        urgent_keywords: updates.urgent_keywords ? JSON.stringify(updates.urgent_keywords) : undefined,
        updated_at: new Date()
      })
    return await getUserPreferences(userId) // Use the function that applies defaults
  } else {
    await db('slack_preferences')
      .insert({
        user_id: userId,
        ...updates,
        urgent_keywords: updates.urgent_keywords ? JSON.stringify(updates.urgent_keywords) : undefined
      })
    return await getUserPreferences(userId) // Use the function that applies defaults
  }
}

export const SlackRepo = {
  getWorkspaceByTeamId,
  getUserPreferences,
  getActiveUserConnection,
  getAllActiveUserConnections,
  getUserConnectionWithPreferences,
  createFocusSession,
  createFocusSessionWorkspace,
  getActiveFocusSession,
  getAllActiveFocusSessions,
  getFocusSessionById,
  getFocusSessionWorkspaces,
  updateFocusSession,
  endAllActiveFocusSessions,
  updateExpiredFocusSession,
  getFocusSessionStatus,
  createSessionActivity,
  createOAuthState,
  getOAuthState,
  deleteOAuthState,
  upsertWorkspace,
  upsertUserConnection,
  disconnectUserConnections,
  disconnectUserWorkspace,
  getUserSlackConnections,
  updateUserPreferences
}
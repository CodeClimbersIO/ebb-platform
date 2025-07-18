import crypto from 'crypto'
import { db } from '../config/database.js'
import { ApiError } from '../middleware/errorHandler.js'
import { EbbEncryption } from '../utils/encryption.js'

interface SlackOAuthResponse {
  ok: boolean
  access_token?: string
  token_type?: string
  scope?: string
  bot_user_id?: string
  app_id?: string
  team?: {
    id: string
    name: string
    domain?: string
  }
  authed_user?: {
    id: string
    scope?: string
    access_token?: string
    token_type?: string
  }
  error?: string
}

interface SlackPreferences {
  enabled?: boolean
  auto_status_update?: boolean
  auto_dnd?: boolean
  custom_status_text?: string
  custom_status_emoji?: string
  auto_reply_enabled?: boolean
  auto_reply_message?: string
  urgent_keywords?: string[]
}

const CLIENT_ID = process.env.SLACK_CLIENT_ID
const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET
const REDIRECT_URI = process.env.SLACK_REDIRECT_URI || `${process.env.API_BASE_URL}/api/slack/callback`
const USER_SCOPES = [
  'users.profile:write',
  'dnd:read',
  'dnd:write'
].join(',')

const BOT_SCOPES = [
  'app_mentions:read',
  'channels:history',
  'chat:write',
  'im:history',
  'im:read',
  'im:write',
  'users:read'
].join(',')

const ENCRYPTION = new EbbEncryption(process.env.SLACK_ENCRYPTION_KEY)

const generateAuthUrl = async (userId: string): Promise<string> => {
  if (!CLIENT_ID) {
    throw new ApiError('Slack client ID not configured', 500)
  }

  const stateToken = crypto.randomBytes(16).toString('hex')
  
  // Store the user ID with the state token temporarily (expires in 10 minutes)
  await db('slack_oauth_states').insert({
    state_token: stateToken,
    user_id: userId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  })
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: BOT_SCOPES,
    redirect_uri: REDIRECT_URI,
    state: stateToken,
    user_scope: USER_SCOPES
  })

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`
}

const exchangeCodeForTokens = async (code: string, state: string): Promise<{ connected: boolean, workspace: string }> => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new ApiError('Slack OAuth credentials not configured', 500)
  }

  // Retrieve and validate the state token
  const stateRecord = await db('slack_oauth_states')
    .where({ state_token: state })
    .where('expires_at', '>', new Date())
    .first()

  if (!stateRecord) {
    throw new ApiError('Invalid or expired OAuth state', 400)
  }

  const userId = stateRecord.user_id

  // Clean up the used state token
  await db('slack_oauth_states').where({ state_token: state }).del()

  try {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI
      })
    })

    const data = await response.json() as SlackOAuthResponse

    if (!data.ok) {
      throw new ApiError(`Slack OAuth error: ${data.error}`, 400)
    }

    if (!data.team || !data.authed_user) {
      throw new ApiError('Invalid OAuth response from Slack', 400)
    }

    // Store or update workspace
    const workspace = await upsertWorkspace({
      team_id: data.team.id,
      team_name: data.team.name,
      team_domain: data.team.domain,
      bot_token: encrypt(data.access_token!),
      bot_user_id: data.bot_user_id!,
      app_id: data.app_id!,
      scope: data.scope!
    })

    // Store user connection
    await upsertUserConnection({
      user_id: userId,
      workspace_id: workspace.id,
      slack_user_id: data.authed_user.id,
      access_token: encrypt(data.authed_user.access_token!),
      scope: data.authed_user.scope!
    })

    // Create default preferences if they don't exist
    await ensureUserPreferences(userId)

    return {
      connected: true,
      workspace: data.team.name
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('Failed to exchange OAuth code', 500)
  }
}

const disconnectUser = async (userId: string): Promise<void> => {
  await db('slack_user_connections')
    .where({ user_id: userId })
    .update({ is_active: false })
}

const getUserSlackStatus = async (userId: string): Promise<{ connected: boolean, workspaces: any[], preferences: any }> => {
  const connections = await db('slack_user_connections as suc')
    .join('slack_workspaces as sw', 'suc.workspace_id', 'sw.id')
    .where({ 'suc.user_id': userId, 'suc.is_active': true })
    .select('sw.team_name', 'sw.team_domain', 'suc.created_at')

  const preferences = await db('slack_preferences')
    .where({ user_id: userId })
    .first()

  return {
    connected: connections.length > 0,
    workspaces: connections,
    preferences: preferences || {}
  }
}

const updateUserPreferences = async (userId: string, updates: SlackPreferences): Promise<any> => {
  const existing = await db('slack_preferences').where({ user_id: userId }).first()
  
  if (existing) {
    const [updated] = await db('slack_preferences')
      .where({ user_id: userId })
      .update({
        ...updates,
        urgent_keywords: updates.urgent_keywords ? JSON.stringify(updates.urgent_keywords) : undefined,
        updated_at: new Date()
      })
      .returning('*')
    return updated
  } else {
    const [created] = await db('slack_preferences')
      .insert({
        user_id: userId,
        ...updates,
        urgent_keywords: updates.urgent_keywords ? JSON.stringify(updates.urgent_keywords) : undefined
      })
      .returning('*')
    return created
  }
}

const upsertWorkspace = async (workspace: any): Promise<any> => {
  const existing = await db('slack_workspaces').where({ team_id: workspace.team_id }).first()
  
  if (existing) {
    const [updated] = await db('slack_workspaces')
      .where({ team_id: workspace.team_id })
      .update({ ...workspace, updated_at: new Date() })
      .returning('*')
    return updated
  } else {
    const [created] = await db('slack_workspaces').insert(workspace).returning('*')
    return created
  }
}

const upsertUserConnection = async (connection: any): Promise<any> => {
  const existing = await db('slack_user_connections')
    .where({ user_id: connection.user_id, workspace_id: connection.workspace_id })
    .first()
  
  if (existing) {
    const [updated] = await db('slack_user_connections')
      .where({ user_id: connection.user_id, workspace_id: connection.workspace_id })
      .update({ ...connection, is_active: true, updated_at: new Date() })
      .returning('*')
    return updated
  } else {
    const [created] = await db('slack_user_connections').insert(connection).returning('*')
    return created
  }
}

const ensureUserPreferences = async (userId: string): Promise<void> => {
  const existing = await db('slack_preferences').where({ user_id: userId }).first()
  
  if (!existing) {
    await db('slack_preferences').insert({ user_id: userId })
  }
}

const encrypt = (text: string): string => {
  return ENCRYPTION.encrypt(text)
}

const decrypt = (encryptedText: string): string => {
  return ENCRYPTION.decrypt(encryptedText)
}

const getDecryptedToken = (encryptedToken: string): string => {
  return decrypt(encryptedToken)
}

export const SlackOAuthService = {
  generateAuthUrl,
  exchangeCodeForTokens,
  disconnectUser,
  getUserSlackStatus,
  updateUserPreferences,
  getDecryptedToken
}
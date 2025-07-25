import crypto from 'crypto'
import { SlackRepo } from '../repos/Slack.js'
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

const generateAuthUrl = async (userId: string, teamId?: string, redirectType?: 'dev' | 'prod'): Promise<string> => {
  if (!CLIENT_ID) {
    throw new ApiError('Slack client ID not configured', 500)
  }

  const baseStateToken = crypto.randomBytes(16).toString('hex')
  
  // Encode redirect preference in the state token
  const stateData = {
    token: baseStateToken,
    redirectType: redirectType || 'dev'
  }
  const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64')
  
  // Store the user ID with the base state token temporarily (expires in 10 minutes)
  await SlackRepo.createOAuthState({
    state_token: baseStateToken,
    user_id: userId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  })
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: BOT_SCOPES,
    redirect_uri: REDIRECT_URI,
    state: encodedState,
    user_scope: USER_SCOPES,
    team: teamId || ''
  })
  console.log('params', params.toString())
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`
}

const exchangeCodeForTokens = async (code: string, state: string): Promise<{ connected: boolean, workspace: string, redirectType: 'dev' | 'prod' }> => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new ApiError('Slack OAuth credentials not configured', 500)
  }

  // Decode the state to get redirect type and base token
  let baseStateToken: string
  let redirectType: 'dev' | 'prod' = 'dev'
  
  try {
    const decodedState = JSON.parse(Buffer.from(state, 'base64').toString())
    baseStateToken = decodedState.token
    redirectType = decodedState.redirectType || 'dev'
  } catch (error) {
    throw new ApiError('Invalid OAuth state format', 400)
  }

  // Retrieve and validate the state token
  const stateRecord = await SlackRepo.getOAuthState(baseStateToken)

  if (!stateRecord) {
    throw new ApiError('Invalid or expired OAuth state', 400)
  }

  const userId = stateRecord.user_id

  // Clean up the used state token
  await SlackRepo.deleteOAuthState(baseStateToken)

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
    const workspace = await SlackRepo.upsertWorkspace({
      team_id: data.team.id,
      team_name: data.team.name,
      team_domain: data.team.domain,
      bot_token: encrypt(data.access_token!),
      bot_user_id: data.bot_user_id!,
      app_id: data.app_id!,
      scope: data.scope!
    })

    // Store user connection
    await SlackRepo.upsertUserConnection({
      user_id: userId,
      workspace_id: workspace.id,
      slack_user_id: data.authed_user.id,
      access_token: encrypt(data.authed_user.access_token!),
      scope: data.authed_user.scope!
    })


    return {
      connected: true,
      workspace: data.team.name,
      redirectType: redirectType
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('Failed to exchange OAuth code', 500)
  }
}

const disconnectUser = async (userId: string): Promise<void> => {
  await SlackRepo.disconnectUserConnections(userId)
}

const disconnectUserWorkspace = async (userId: string, workspaceId: string): Promise<void> => {
  await SlackRepo.disconnectUserWorkspace(userId, workspaceId)
}

const getUserSlackStatus = async (userId: string): Promise<{ connected: boolean, workspaces: any[], preferences: any }> => {
  const connections = await SlackRepo.getUserSlackConnections(userId)
  const preferences = await SlackRepo.getUserPreferences(userId)

  return {
    connected: connections.length > 0,
    workspaces: connections,
    preferences
  }
}

const updateUserPreferences = async (userId: string, updates: SlackPreferences): Promise<any> => {
  return await SlackRepo.updateUserPreferences(userId, updates)
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
  disconnectUserWorkspace,
  getUserSlackStatus,
  updateUserPreferences,
  getDecryptedToken
}
import { Router } from 'express'
import type { Request, Response } from 'express'
import { SlackOAuthService } from '../services/SlackOAuthService.js'
import { SlackService } from '../services/SlackService.js'
import { SlackBotService } from '../services/SlackBotService.js'
import { AuthMiddleware } from '../middleware/auth.js'
import { asyncHandler, ApiError } from '../middleware/errorHandler.js'

const router = Router()

const getSuccessRedirectUrl = (result: { connected: boolean, workspace: string, redirectType: 'dev' | 'prod' }): string => {
  if (result.redirectType === 'prod') {
    return 'https://ebb.cool/slack-success?slack=connected&workspace=' + encodeURIComponent(result.workspace)
  }
  return 'http://localhost:1420/settings/integrations?slack=connected&workspace=' + encodeURIComponent(result.workspace)
}

const initiateOAuth = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const { redirectType } = req.query
  const validRedirectType = redirectType === 'prod' ? 'prod' : 'dev'

  const authUrl = await SlackOAuthService.generateAuthUrl(req.user.id, undefined, validRedirectType)
  
  res.json({
    success: true,
    data: { authUrl }
  })
}

const handleOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query

  if (error) {
    throw new ApiError(`Slack OAuth error: ${error}`, 400)
  }

  if (!code || typeof code !== 'string') {
    throw new ApiError('Authorization code is required', 400)
  }

  if (!state || typeof state !== 'string') {
    throw new ApiError('OAuth state is required', 400)
  }


  const result = await SlackOAuthService.exchangeCodeForTokens(code, state)

  // Use the appropriate frontend URL based on redirect type
  const successRedirectUrl = getSuccessRedirectUrl(result)
  const redirectUrl = `${successRedirectUrl}`
  res.redirect(redirectUrl)
}

const disconnectSlack = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  await SlackOAuthService.disconnectUser(req.user.id)
  
  res.json({
    success: true,
    message: 'Slack integration disconnected successfully'
  })
}

const disconnectSlackWorkspace = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  if (!req.params.workspaceId) {
    throw new ApiError('Workspace ID is required', 400)
  }

  await SlackOAuthService.disconnectUserWorkspace(req.user.id, req.params.workspaceId)
  
  res.json({
    success: true,
    message: 'Slack workspace disconnected successfully'
  })
}

const getSlackStatus = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const status = await SlackOAuthService.getUserSlackStatus(req.user.id)
  
  res.json({
    success: true,
    data: status
  })
}

const updateSlackPreferences = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const preferences = await SlackOAuthService.updateUserPreferences(req.user.id, req.body)
  
  res.json({
    success: true,
    data: preferences
  })
}

const startFocusSession = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const { sessionId, durationMinutes } = req.body
  const focusSessionId = sessionId || `focus-session-${Date.now()}`
  const duration = durationMinutes || 25 // Default 25 minutes

  const result = await SlackService.startFocusSession(req.user.id, focusSessionId, duration)
  
  res.json({
    success: true,
    message: `Focus session started - ${result.workspaces.length} workspace(s) processed`,
    data: {
      sessionId: focusSessionId,
      durationMinutes: duration,
      ...result
    }
  })
}

const endFocusSession = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const result = await SlackService.endFocusSession(req.user.id)
  
  res.json({
    success: true,
    message: `Focus session ended - ${result.workspaces.length} workspace(s) processed`,
    data: result
  })
}

const getFocusSessionStatus = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const status = await SlackService.getFocusSessionStatus(req.user.id)
  
  res.json({
    success: true,
    data: status
  })
}

const setSlackStatus = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const { statusText, statusEmoji, expiration } = req.body

  if (!statusText) {
    throw new ApiError('Status text is required', 400)
  }

  const result = await SlackService.setUserStatus(
    req.user.id, 
    statusText, 
    statusEmoji || ':speech_balloon:',
    expiration
  )
  
  res.json({
    success: true,
    message: `Slack status updated - ${result.workspaces.length} workspace(s) processed`,
    data: {
      statusText,
      statusEmoji: statusEmoji || ':speech_balloon:',
      expiration,
      ...result
    }
  })
}

const clearSlackStatus = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const result = await SlackService.clearUserStatus(req.user.id)
  
  res.json({
    success: true,
    message: `Slack status cleared - ${result.workspaces.length} workspace(s) processed`,
    data: result
  })
}

const controlSlackDnd = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const { action, durationMinutes } = req.body

  if (action === 'enable') {
    const duration = durationMinutes || 30
    const result = await SlackService.enableDnd(req.user.id, duration)
    
    res.json({
      success: true,
      message: `DND ${action} - ${result.workspaces.length} workspace(s) processed`,
      data: {
        action: 'enable',
        durationMinutes: duration,
        ...result
      }
    })
  } else if (action === 'disable') {
    const result = await SlackService.disableDnd(req.user.id)
    
    res.json({
      success: true,
      message: `DND ${action} - ${result.workspaces.length} workspace(s) processed`,
      data: {
        action: 'disable',
        ...result
      }
    })
  } else {
    throw new ApiError('Action must be "enable" or "disable"', 400)
  }
}

const getSlackDndInfo = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const dndInfo = await SlackService.getDndInfo(req.user.id)
  
  res.json({
    success: true,
    data: dndInfo
  })
}

const handleSlackEvents = async (req: Request, res: Response): Promise<void> => {
  // Verify the request signature
  const signature = req.headers['x-slack-signature'] as string
  const timestamp = req.headers['x-slack-request-timestamp'] as string
  const body = JSON.stringify(req.body)

  if (!signature || !timestamp) {
    throw new ApiError('Missing Slack signature headers', 400)
  }

  // Check timestamp to prevent replay attacks (should be within 5 minutes)
  const currentTimestamp = Math.floor(Date.now() / 1000)
  if (Math.abs(currentTimestamp - parseInt(timestamp)) > 300) {
    throw new ApiError('Request timestamp too old', 400)
  }

  const isValidSignature = await SlackBotService.verifyEventSignature(body, timestamp, signature)
  if (!isValidSignature) {
    throw new ApiError('Invalid request signature', 401)
  }

  // Handle URL verification challenge
  if (req.body.type === 'url_verification') {
    res.json({ challenge: req.body.challenge })
    return
  }

  // Handle events
  if (req.body.type === 'event_callback') {
    await SlackBotService.handleEvent(req.body)
  }

  res.json({ ok: true })
}

// OAuth routes
router.get('/auth', AuthMiddleware.authenticateToken, asyncHandler(initiateOAuth))
router.get('/callback', asyncHandler(handleOAuthCallback))

// Management routes
router.delete('/disconnect', AuthMiddleware.authenticateToken, asyncHandler(disconnectSlack))
router.delete('/disconnect/:workspaceId', AuthMiddleware.authenticateToken, asyncHandler(disconnectSlackWorkspace))
router.get('/status', AuthMiddleware.authenticateToken, asyncHandler(getSlackStatus))
router.put('/preferences', AuthMiddleware.authenticateToken, asyncHandler(updateSlackPreferences))

// Focus session integration routes
router.post('/focus-session/start', AuthMiddleware.authenticateToken, asyncHandler(startFocusSession))
router.post('/focus-session/end', AuthMiddleware.authenticateToken, asyncHandler(endFocusSession))
router.get('/focus-session/status', AuthMiddleware.authenticateToken, asyncHandler(getFocusSessionStatus))

// Manual Slack control routes
router.post('/status/set', AuthMiddleware.authenticateToken, asyncHandler(setSlackStatus))
router.post('/status/clear', AuthMiddleware.authenticateToken, asyncHandler(clearSlackStatus))
router.post('/dnd', AuthMiddleware.authenticateToken, asyncHandler(controlSlackDnd))
router.get('/dnd', AuthMiddleware.authenticateToken, asyncHandler(getSlackDndInfo))

// Webhook route (no auth required - Slack sends events here)
router.post('/events', asyncHandler(handleSlackEvents))

export const SlackController = {
  router,
  initiateOAuth,
  handleOAuthCallback,
  disconnectSlack,
  getSlackStatus,
  updateSlackPreferences,
  handleSlackEvents
}
// Utility for mapping Slack API errors to standardized error types

export interface SlackErrorDetails {
  type: 'permission_revoked' | 'network_error' | 'rate_limited' | 'user_error'
  message: string
  action: 'reconnect' | 'retry' | 'wait' | 'none'
}

export const mapSlackError = (slackError: string): SlackErrorDetails => {
  const errorMap: Record<string, SlackErrorDetails> = {
    // OAuth/Permission errors
    'invalid_auth': {
      type: 'permission_revoked',
      message: 'Slack connection has been revoked. Please reconnect your workspace.',
      action: 'reconnect'
    },
    'account_inactive': {
      type: 'permission_revoked', 
      message: 'Your Slack account is inactive in this workspace.',
      action: 'reconnect'
    },
    'token_revoked': {
      type: 'permission_revoked',
      message: 'Slack access has been revoked. Please reconnect your workspace.',
      action: 'reconnect'
    },
    'no_permission': {
      type: 'permission_revoked',
      message: 'Insufficient permissions. Please reconnect with required permissions.',
      action: 'reconnect'
    },
    'missing_scope': {
      type: 'permission_revoked',
      message: 'Missing required Slack permissions. Please reconnect your workspace.',
      action: 'reconnect'
    },

    // Rate limiting
    'ratelimited': {
      type: 'rate_limited',
      message: 'Slack API rate limit exceeded. Please try again in a few minutes.',
      action: 'wait'
    },

    // Network/API errors  
    'fatal_error': {
      type: 'network_error',
      message: 'Slack API encountered an error. Please try again.',
      action: 'retry'
    },
    'internal_error': {
      type: 'network_error', 
      message: 'Slack service temporarily unavailable. Please try again.',
      action: 'retry'
    },
    'service_unavailable': {
      type: 'network_error',
      message: 'Slack service temporarily unavailable. Please try again.',
      action: 'retry'
    },

    // DND specific errors
    'snooze_not_active': {
      type: 'user_error',
      message: 'Do Not Disturb is not currently active.',
      action: 'none'
    },
    'snooze_end_failed': {
      type: 'network_error',
      message: 'Failed to disable Do Not Disturb. Please try again.',
      action: 'retry'
    },

    // Status specific errors
    'user_not_found': {
      type: 'permission_revoked',
      message: 'User not found in this workspace. Please reconnect.',
      action: 'reconnect'
    }
  }

  return errorMap[slackError] || {
    type: 'network_error',
    message: `Slack API error: ${slackError}`,
    action: 'retry'
  }
}

export const shouldRetryError = (errorType: string): boolean => {
  return errorType === 'network_error'
}

export const getRetryDelay = (attempt: number): number => {
  // 2 retries over 5 seconds: delays of 1s, 2s
  return Math.min(1000 * attempt, 2000)
}
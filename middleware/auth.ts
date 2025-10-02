import type { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase.js'
import { ApiError, asyncHandler } from './errorHandler.js'
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
    }
  }
}

// founder user
const TEST_USER = {
  id: '409cf9b9-7aae-4a13-aca9-1bcd7b9a4209',
  email: 'founder@example.com',
  role: 'user'
}

const runTestMode = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null

  if (!token) {
    throw new ApiError('Access token required', 401)
  }

  // In test mode, if token is 'valid_test_token', allow access
  if (token === 'valid_test_token') {
    req.user = TEST_USER
    next()
    return
  }

  // For any other token in test mode, return the standard error
  throw new ApiError('Invalid or expired token', 401)
}

const authenticateTokenImpl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // In test mode, use mock authentication for valid tokens
  if (process.env.NODE_ENV === 'test') {
    return runTestMode(req, res, next)
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null

  if (!token) {
    throw new ApiError('Access token required', 401)
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new ApiError('Invalid or expired token', 401)
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role
  }

  next()
}

const authenticateToken = asyncHandler(authenticateTokenImpl)

export const AuthMiddleware = {
  authenticateToken,
} 

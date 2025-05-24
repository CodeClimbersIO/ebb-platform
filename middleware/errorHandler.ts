import type { Request, Response, NextFunction } from 'express'

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export class ApiError extends Error {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    
    Error.captureStackTrace(this, this.constructor)
  }
}


export const sendErrorResponse = (res: Response, error: ApiError | Error, statusCode?: number) => {
  const status = statusCode || (error instanceof ApiError ? error.statusCode : 500)
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  res.status(status).json({
    success: false,
    error: error.message,
    ...(isDevelopment && { stack: error.stack })
  })
} 
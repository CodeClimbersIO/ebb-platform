import { Router } from 'express'
import type { Request, Response } from 'express'
import { FriendsService } from '../services/FriendsService.js'
import { AuthMiddleware } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

const inviteFriend = async (req: Request, res: Response): Promise<void> => {
  const friendRequest = await FriendsService.inviteFriend(req)
  res.status(201).json({
    success: true,
    data: friendRequest,
    message: 'Friend request sent successfully'
  })
}

const respondToFriendRequest = async (req: Request, res: Response): Promise<void> => {
  const result = await FriendsService.respondToFriendRequest(req)
  const action = req.body.action
  res.json({
    success: true,
    data: result,
    message: action === 'accept' ? 'Friend request accepted' : 'Friend request rejected'
  })
}

const getPendingRequestsSent = async (req: Request, res: Response): Promise<void> => {
  const requests = await FriendsService.getPendingRequestsSent(req)
  res.json({
    success: true,
    data: requests
  })
}

const getPendingRequestsReceived = async (req: Request, res: Response): Promise<void> => {
  const requests = await FriendsService.getPendingRequestsReceived(req)
  res.json({
    success: true,
    data: requests
  })
}

const getFriends = async (req: Request, res: Response): Promise<void> => {
  const friends = await FriendsService.getFriends(req)
  res.json({
    success: true,
    data: friends
  })
}

// Initialize routes with authentication middleware and async error handling
router.post('/invite', AuthMiddleware.authenticateToken, asyncHandler(inviteFriend))
router.post('/requests/:requestId/respond', AuthMiddleware.authenticateToken, asyncHandler(respondToFriendRequest))
router.get('/requests/sent', AuthMiddleware.authenticateToken, asyncHandler(getPendingRequestsSent))
router.get('/requests/received', AuthMiddleware.authenticateToken, asyncHandler(getPendingRequestsReceived))
router.get('/list', AuthMiddleware.authenticateToken, asyncHandler(getFriends))

export const FriendsController = {
  router,
  inviteFriend,
  respondToFriendRequest,
  getPendingRequestsSent,
  getPendingRequestsReceived,
  getFriends
} 